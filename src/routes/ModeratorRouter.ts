import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { NextFunction } from 'connect'
import { Image } from '../database/entities/Image'
import { bucket } from '../utils/StorageUtil'
import { moderatorImageDelete } from '../bot'

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
  return next()
}
ModeratorRouter.use(authMiddleware)
ModeratorRouter.route('/').get((req, res) => {
  res.render('pages/moderator/index', {
    layout: 'layouts/moderator'
  })
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
    relations: ['uploader']
  })
  if (!image) {
    return res.send('Image not found. <a href="/moderator/image">go back</a>')
  }
  return res.render('pages/moderator/image', {
    layout: 'layouts/moderator',
    image
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
    return res.redirect(
      '/moderator/images?message=Image does not exist&class=is-danger'
    )
  }
  await bucket.file(image.path).delete()
  image.deleted = true
  image.deletionReason = req.query.type || 'LEGAL'
  await image.save()
  await moderatorImageDelete(image, req.user, req.ip)
  return res.redirect(
    `/moderator/images/${image.shortId}?message=Image ${image.path} was deleted with reason ${image.deletionReason}&class=is-success`
  )
})

export default ModeratorRouter
