import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import crypto from 'crypto'

import { Paste } from '../database/entities/Paste'
import { randomUserId, randomImageId } from '../utils/RandomUtil'
import { pasteLimiter } from '../utils/RatelimitUtil'

const PasteRouter = express.Router()
PasteRouter.use(bodyParser.json())
const notfound = Buffer.from('not found').toString('base64')
PasteRouter.route('/').get(async (req, res) => {
  res.render('pages/paste/index', {
    layout: 'layouts/paste'
  })
})
PasteRouter.route('/upload').post(pasteLimiter, async (req, res) => {
  if (!req.loggedIn) {
    return res.json({
      success: false,
      error: 'not logged in'
    })
  }

  const sha1 = crypto.createHash('sha1')
  const paste = new Paste()
  const content = Buffer.from(req.body.content)
  paste.uploader = req.user
  paste.content = content.toString('base64')
  paste.creationDate = new Date()
  paste.deleted = false
  paste.encrypted = false
  paste.hash = sha1.update(content).digest('hex')
  paste.id = randomUserId()
  paste.shortId = randomImageId(req.user.longNames)
  paste.size = content.byteLength
  await paste.save()
  return res.json({
    success: true,
    url: `https://mirage.photos/paste/${paste.shortId}`
  })
})
PasteRouter.route('/:id').get(async (req, res) => {
  let paste = await Paste.findOne({
    where: {
      shortId: req.params.id
    },
    relations: ['uploader']
  })
  if (!paste) {
    return res.render('pages/paste/notfound', {
      layout: 'layouts/paste'
    })
  }
  if (paste.deleted) {
    return res.render('pages/paste/deleted', {
      layout: 'layouts/paste',
      reason: paste.deletionReason
    })
  }
  return res.render('pages/paste/paste', {
    layout: 'layouts/paste',
    paste,
    content: paste.content
  })
})
PasteRouter.route('/raw/:id').get(async (req, res) => {
  let paste = await Paste.findOne({
    where: {
      shortId: req.params.id
    },
    relations: ['uploader']
  })
  if (!paste) {
    return res.redirect(`/paste/${req.params.id}`)
  }
  if (paste.deleted) {
    return res.redirect(`/paste/${req.params.id}`)
  }
  let content = Buffer.from(paste.content, 'base64')
  res.setHeader('Content-Type', 'text/plain')
  res.send(content.toString())
})
export default PasteRouter
