import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { NextFunction } from 'connect'
import { Image } from '../database/entities/Image'
import { bucket } from '../utils/StorageUtil'
import { moderatorImageDelete } from '../bot'
import { Report } from '../database/entities/Report'

const ModeratorRouter = express.Router()
ModeratorRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).send('Unauthorized')
  }
  if (!req.user.moderator && !req.user.admin) {
    return res.status(401).send('Not an admin or moderator')
  }
  if (req.query) {
    res.locals.query = req.query
  } else {
    res.locals.query = {}
  }
  if (!req.user.mfa_enabled) {
    req.flash('is-danger', 'You must enable 2FA to access this section')
    return res.status(401).redirect('/account/mfa')
  }
  return next()
}
ModeratorRouter.use(authMiddleware)
ModeratorRouter.route('/').get((req, res) => {
  res.render('pages/moderator/index', {
    layout: 'layouts/moderator'
  })
})

ModeratorRouter.route('/reports').get(async (req, res) => {
  let reports = await Report.find({
    where: {
      resolved: false
    },
    relations: ['image']
  })
  res.render('pages/moderator/reports', {
    layout: 'layouts/moderator',
    reports
  })
})

ModeratorRouter.route('/reports/:id').get(async (req, res) => {
  let report = await Report.findOne({
    where: {
      id: req.params.id
    },
    relations: ['image']
  })
  if (!report) {
    return res
      .status(404)
      .send(
        'whoops that report doesnt exist, <a href="/moderator/reports">go back?</a>'
      )
  }
  res.render('pages/moderator/report', {
    layout: 'layouts/moderator',
    report
  })
})

ModeratorRouter.route('/reports/:id/resolve').get(async (req, res) => {
  let report = await Report.findOne({
    where: {
      id: req.params.id
    }
  })
  if (!report) {
    return res
      .status(404)
      .send(
        'whoops that report doesnt exist, <a href="/moderator/reports">go back?</a>'
      )
  }
  report.resolved = true
  report.resolvedBy = req.user.id
  await report.save()
  req.flash('is-success', `Report ${report.id} set to resolved`)
  return res.redirect(`/moderator/reports/${req.params.id}`)
})

ModeratorRouter.route('/images')
  .get((req, res) => {
    res.render('pages/moderator/lookup', {
      layout: 'layouts/moderator'
    })
  })
  .post((req, res) => {
    res.redirect(`/moderator/images/${req.body.image}`)
  })

ModeratorRouter.route('/images/:id').get(async (req, res) => {
  let shortId = req.params.id.split('.')[0] // ignore file extension if it exists
  let image = await Image.findOne({
    where: {
      shortId
    },
    relations: ['uploader', 'reports']
  })
  if (!image) {
    return res.send('Image not found. <a href="/moderator/image">go back</a>')
  }
  let reports = [] as any
  if (image.reports) {
    reports = image.reports.filter(report => !report.resolved)
  }
  return res.render('pages/moderator/image', {
    layout: 'layouts/moderator',
    image,
    reports
  })
})

ModeratorRouter.route('/images/:id/delete').get(async (req, res) => {
  let image = await Image.findOne({
    where: {
      id: req.params.id
    },
    relations: ['uploader']
  })
  if (!image) {
    req.flash('is-danger', 'Image does not exist')
    return res.redirect('/moderator/images')
  }
  await bucket.file(image.path).delete()
  image.deleted = true
  image.deletionReason = req.query.type || 'LEGAL'
  await image.save()
  await moderatorImageDelete(image, req.user, req.ip)
  req.flash(
    'is-success',
    `Image ${image.path} was deleted with reason ${image.deletionReason}`
  )
  return res.redirect(`/moderator/images/${image.shortId}`)
})

export default ModeratorRouter
