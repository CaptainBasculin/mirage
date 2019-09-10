import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { NextFunction } from 'connect'
import { Invite } from '../database/entities/Invite'
import { Image } from '../database/entities/Image'
import { User } from '../database/entities/User'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'
const AdminRouter = express.Router()
AdminRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).send('Unauthorized')
  }
  if (!req.user.admin) {
    return res.status(401).send('Not an admin')
  }
  return next()
}

AdminRouter.route('/').get(authMiddleware, (req, res) => {
  res.render('pages/admin/index', {
    layout: 'layouts/admin'
  })
})

AdminRouter.route('/invites').get(authMiddleware, async (req, res) => {
  let invites = await Invite.find({
    relations: ['creator']
  })
  res.render('pages/admin/invites', {
    layout: 'layouts/admin',
    invites: invites.map(invite => invite.adminSerialize()).reverse()
  })
})
AdminRouter.route('/images').get(authMiddleware, async (req, res) => {
  let images = await Image.find({
    relations: ['uploader']
  })
  res.render('pages/admin/images', {
    layout: 'layouts/admin',
    images: images.map(image => image.serialize()).reverse()
  })
})

AdminRouter.route('/urls').get(authMiddleware, async (req, res) => {
  let urls = await ShortenedUrl.find({
    relations: ['creator']
  })
  res.render('pages/admin/urls', {
    layout: 'layouts/admin',
    urls: urls.map(url => url.serialize()).reverse()
  })
})

AdminRouter.route('/users').get(authMiddleware, async (req, res) => {
  let users = await User.find({
    relations: ['invites', 'images']
  })
  res.render('pages/admin/users/index', {
    layout: 'layouts/admin',
    users: users.map(user => user.serialize())
  })
})

AdminRouter.route('/users/:id').get(authMiddleware, async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    },
    relations: ['invites', 'images']
  })
  if (!user) {
    return res.status(404)
  }
  let serialized = user!.serialize()
  serialized.images = serialized.images.reverse()
  serialized.invites = serialized.invites.reverse()
  res.render('pages/admin/users/user', {
    layout: 'layouts/admin',
    user: user!.serialize()
  })
})

export default AdminRouter
