import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { NextFunction } from 'connect'
import { Invite } from '../database/entities/Invite'
import { Image } from '../database/entities/Image'
import { User } from '../database/entities/User'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'
import { bucket } from '../utils/StorageUtil'
import sgMail from '@sendgrid/mail'

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
    images: images.map(image => image.serialize()).reverse(),
    query: req.query || {
      message: false,
      class: false
    }
  })
})
AdminRouter.route('/images/:id/delete').get(
  authMiddleware,
  async (req, res) => {
    let image = await Image.findOne({
      where: {
        id: req.params.id
      },
      relations: ['uploader']
    })
    if (!image) {
      return res.redirect(
        '/admin/images?message=Image does not exist&class=is-danger'
      )
    }
    await bucket.file(image.path).delete()
    image.deleted = true
    image.deletionReason = req.query.type || 'LEGAL'
    await image.save()
    return res.redirect(
      `${
        (req.query.loc || 'admin') === 'admin'
          ? '/admin/images'
          : `/admin/users/${image.uploader.username}`
      }?message=Image ${image.path} was deleted with reason ${
        image.deletionReason
      }&class=is-success`
    )
  }
)
AdminRouter.route('/urls').get(authMiddleware, async (req, res) => {
  let urls = await ShortenedUrl.find({
    relations: ['creator']
  })
  res.render('pages/admin/urls', {
    layout: 'layouts/admin',
    urls: urls.map(url => url.serialize()).reverse(),
    query: req.query || {
      message: false,
      class: false
    }
  })
})
AdminRouter.route('/urls/:id/delete').get(authMiddleware, async (req, res) => {
  let url = await ShortenedUrl.findOne({
    where: {
      id: req.params.id
    },
    relations: ['creator']
  })
  if (!url) {
    return res.redirect(
      '/admin/urls?message=Shortened URL does not exist&class=is-danger'
    )
  }
  url.deleted = true
  url.deletionReason = req.query.type || 'LEGAL'
  await url.save()
  return res.redirect(
    `${
      (req.query.loc || 'admin') === 'admin'
        ? '/admin/urls'
        : `/admin/users/${url.creator.username}`
    }?message=URL ${url.shortId} was deleted with reason ${
      url.deletionReason
    }&class=is-success`
  )
})
AdminRouter.route('/users').get(authMiddleware, async (req, res) => {
  let users = await User.find({
    relations: ['invites', 'images']
  })
  res.render('pages/admin/users/index', {
    layout: 'layouts/admin',
    users: users.map(user => user.serialize()),
    query: req.query || {
      message: false,
      class: false
    }
  })
})

AdminRouter.route('/users/:id').get(authMiddleware, async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    },
    relations: ['invites', 'images', 'urls']
  })
  if (!user) {
    return res.status(404)
  }
  let serialized = user!.serialize()
  serialized.images = serialized.images.reverse()
  serialized.invites = serialized.invites.reverse()
  serialized.urls = serialized.urls.reverse()
  res.render('pages/admin/users/user', {
    layout: 'layouts/admin',
    user: user!.serialize()
  })
})

AdminRouter.route('/users/:id/suspend').post(
  authMiddleware,
  async (req, res) => {
    let user = await User.findOne({
      where: {
        username: req.params.id
      },
      relations: ['invites', 'images', 'urls']
    })
    if (!user) {
      return res.status(404)
    }
    user.suspended = true
    user.suspensionReason = req.body.reason
    await user.save()
    sgMail.setApiKey(process.env.EMAIL_KEY!)
    await sgMail.send({
      to: user.email,
      from: process.env.EMAIL_FROM!,
      subject: 'Mirage: your account was suspended',
      html: `Hello, ${user.username}!<br/>Your account was suspended.<br/>You were suspended for the reason:<br/>${user.suspensionReason}<br/><br/><br/>Until your suspension is lifted, you may not do the following:<ul><li>Upload images</li><li>Create, use, or distribute invites</li><li>Create shortened URLs</li><li>Login to the account panel</li></ul>.<br/>Contact a staff member on the Discord if you would like to dispute this decision.`
    })
    return res.redirect(
      `/admin/users/${user.username}?message=User was sucessfully suspended&type=is-success`
    )
  }
)

AdminRouter.route('/users/:id/unsuspend').post(
  authMiddleware,
  async (req, res) => {
    let user = await User.findOne({
      where: {
        username: req.params.id
      },
      relations: ['invites', 'images', 'urls']
    })
    if (!user) {
      return res.status(404)
    }
    user.suspended = false
    user.suspensionReason = ''
    await user.save()
    sgMail.setApiKey(process.env.EMAIL_KEY!)
    await sgMail.send({
      to: user.email,
      from: process.env.EMAIL_FROM!,
      subject: 'Mirage: your suspension was lifted',
      html: `Hello, ${user.username}!<br/>Your account's suspension was lifted.<br/>You now have any privileges you had before your account was suspended.<br/>If any of your images were unavailable while you were suspended, you now have access to view them.<br/>We are sorry for the inconvenience.`
    })
    return res.redirect(
      `/admin/users/${user.username}?message=User was sucessfully unsuspended&type=is-success`
    )
  }
)

export default AdminRouter
