import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { NextFunction } from 'connect'
import { Invite } from '../database/entities/Invite'
import { Image } from '../database/entities/Image'
import { User } from '../database/entities/User'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'
import { bucket } from '../utils/StorageUtil'
import sgMail from '@sendgrid/mail'
import { Banner } from '../database/entities/Banner'
import { randomUserId } from '../utils/RandomUtil'
import { Domain } from '../database/entities/Domain'

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
  if (!req.user.mfa_enabled) {
    req.flash('is-danger', 'You must enable 2FA to access this section')
    return res.status(401).redirect('/account/mfa')
  }
  return next()
}

AdminRouter.use(authMiddleware)

AdminRouter.route('/').get((req, res) => {
  res.render('pages/admin/index', {
    layout: 'layouts/admin'
  })
})

AdminRouter.route('/invites').get(async (req, res) => {
  let invites = await Invite.find({
    relations: ['creator']
  })
  res.render('pages/admin/invites', {
    layout: 'layouts/admin',
    invites: invites.map(invite => invite.adminSerialize()).reverse()
  })
})
AdminRouter.route('/invites/wave').get(async (req, res) => {
  let users = await User.find({})
  users.forEach(user => {
    user.availableInvites = user.availableInvites || 0
    user.availableInvites = user.availableInvites + 1
    user.save()
  })
  req.flash('is-success', 'Invite wave was started')
  return res.redirect('/admin/invites')
})
AdminRouter.route('/images').get(async (req, res) => {
  let images = await Image.find({
    relations: ['uploader']
  })
  res.render('pages/admin/images', {
    layout: 'layouts/admin',
    images: images.map(image => image.serialize()).reverse()
  })
})
AdminRouter.route('/images/:id/delete').get(async (req, res) => {
  let image = await Image.findOne({
    where: {
      id: req.params.id
    },
    relations: ['uploader']
  })
  if (!image) {
    req.flash('is-danger', 'Image does not exist')
    return res.redirect('/admin/images')
  }
  await bucket.file(image.path).delete()
  image.deleted = true
  image.deletionReason = req.query.type || 'LEGAL'
  await image.save()
  req.flash(
    'is-success',
    `Image ${image.path} was deleted with reason ${image.deletionReason}`
  )
  return res.redirect(
    `${
      (req.query.loc || 'admin') === 'admin'
        ? '/admin/images'
        : `/admin/users/${image.uploader.username}`
    }`
  )
})
AdminRouter.route('/urls').get(async (req, res) => {
  let urls = await ShortenedUrl.find({
    relations: ['creator']
  })
  res.render('pages/admin/urls', {
    layout: 'layouts/admin',
    urls: urls.map(url => url.serialize()).reverse()
  })
})
AdminRouter.route('/urls/:id/delete').get(async (req, res) => {
  let url = await ShortenedUrl.findOne({
    where: {
      id: req.params.id
    },
    relations: ['creator']
  })
  if (!url) {
    req.flash('is-danger', 'Shortened URL does not exist')
    return res.redirect('/admin/urls')
  }
  url.deleted = true
  url.deletionReason = req.query.type || 'LEGAL'
  await url.save()
  req.flash(
    'is-success',
    `URL ${url.shortId} was deleted with reason ${url.deletionReason}`
  )
  return res.redirect(
    `${
      (req.query.loc || 'admin') === 'admin'
        ? '/admin/urls'
        : `/admin/users/${url.creator.username}`
    }`
  )
})

AdminRouter.route('/users').get(async (req, res) => {
  let users = await User.find()
  //users = users.sort((a, b) => a.id - b.id)
  res.render('pages/admin/users/index', {
    layout: 'layouts/admin',
    users: users.map(user => user.serialize())
  })
})

AdminRouter.route('/users/:id').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    }
  })
  if (!user) {
    return res.status(404)
  }
  res.render('pages/admin/users/user', {
    layout: 'layouts/admin',
    user: user!.serialize()
  })
})

AdminRouter.route('/users/:id/grant_invite').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    },
    relations: ['invites', 'images', 'urls']
  })
  if (!user) {
    return res.status(404)
  }
  user.availableInvites = (user.availableInvites || 0) + 1
  await user.save()
  sgMail.setApiKey(process.env.EMAIL_KEY!)
  await sgMail.send({
    to: user.email,
    from: process.env.EMAIL_FROM!,
    subject: 'Mirage: you were granted an invite by an administrator',
    html: `Hello, ${user.username}!<br/>Congratulations, you have been granted an invite by an administrator.<br/>Your new available invitation count is: <strong>${user.availableInvites}</strong>`
  })
  req.flash('is-success', 'User was granted an invite')
  return res.redirect(`/admin/users/${user.username}`)
})

AdminRouter.route('/users/:id/remove_invite').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    },
    relations: ['invites', 'images', 'urls']
  })
  if (!user) {
    return res.status(404)
  }
  user.availableInvites = (user.availableInvites || 0) - 1
  if (user.availableInvites < 1) {
    user.availableInvites = 0
  }
  await user.save()
  req.flash('is-success', "User's invite was removed")
  return res.redirect(`/admin/users/${user.username}`)
})

AdminRouter.route('/users/:id/toggle_creator').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    },
    relations: ['invites', 'images', 'urls']
  })
  if (!user) {
    return res.status(404)
  }
  user.inviteCreator = !user.inviteCreator

  await user.save()
  req.flash(
    'is-success',
    `User's invite creator status is now: ${user.inviteCreator}`
  )
  return res.redirect(`/admin/users/${user.username}`)
})

AdminRouter.route('/users/:id/suspend').post(async (req, res) => {
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
  req.flash('is-success', 'User was successfully suspended')
  return res.redirect(`/admin/users/${user.username}`)
})

AdminRouter.route('/users/:id/unsuspend').post(async (req, res) => {
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
  req.flash('is-success', 'User was successfully unsuspended')
  return res.redirect(`/admin/users/${user.username}`)
})

AdminRouter.route('/users/:id/invite_ban').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    },
    relations: ['invites', 'images', 'urls']
  })
  if (!user) {
    return res.status(404)
  }
  user.inviteBanned = true
  await user.save()
  req.flash('is-success', 'User was banned from the invite system')
  return res.redirect(`/admin/users/${user.username}`)
})

AdminRouter.route('/users/:id/invite_unban').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      username: req.params.id
    },
    relations: ['invites', 'images', 'urls']
  })
  if (!user) {
    return res.status(404)
  }
  user.inviteBanned = false
  await user.save()
  req.flash('is-success', 'User was unbanned from the invite system')
  return res.redirect(`/admin/users/${user.username}`)
})

AdminRouter.route('/domains').get(async (req, res) => {
  const domains = await Domain.find({
    relations: ['donor']
  })
  res.render('pages/admin/domains/index', {
    domains,
    layout: 'layouts/admin'
  })
})

AdminRouter.route('/domains/create')
  .get((req, res) => {
    res.render('pages/admin/domains/create', {
      layout: 'layouts/admin'
    })
  })
  .post(async (req, res) => {
    let domainExists = await Domain.findOne({
      where: {
        domain: req.body.domain
      }
    })
    if (domainExists) {
      req.flash('is-danger', 'Domain already exists')
      return res.redirect('/admin/domains/create')
    }

    const domain = new Domain()
    domain.id = randomUserId()
    domain.domain = req.body.domain
    domain.public = req.body.public && req.body.public === 'on'
    domain.wildcard = req.body.wildcard && req.body.wildcard === 'on'
    domain.editable = req.body.editable && req.body.editable === 'on'

    if (req.body.donor && req.body.donor.length > 0) {
      let donor = await User.findOne({
        where: {
          username: req.body.donor
        }
      })
      if (!donor) {
        req.flash('is-danger', 'Donor does not exist, try again')
        return res.redirect('/admin/domains/create')
      }
      domain.donor = donor
    }

    await domain.save()

    req.flash('is-success', 'Domain created successfully')
    res.redirect(`/admin/domains/${domain.domain}`)
  })

AdminRouter.route('/domains/:domain')
  .get(async (req, res) => {
    const domain = await Domain.findOne({
      where: {
        domain: req.params.domain
      },
      relations: ['donor']
    })
    if (!domain) {
      req.flash('is-danger', 'Domain does not exist')
      return res.redirect('/admin/domains')
    }
    return res.render('pages/admin/domains/domain', {
      domain,
      layout: 'layouts/admin'
    })
  })
  .post(async (req, res) => {
    const domain = await Domain.findOne({
      where: {
        domain: req.params.domain
      }
    })
    if (!domain) {
      req.flash('is-danger', 'Domain does not exist')
      return res.redirect('/admin/domains')
    }
    domain.public = req.body.public && req.body.public === 'on'
    domain.wildcard = req.body.wildcard && req.body.wildcard === 'on'
    domain.editable = req.body.editable && req.body.editable === 'on'

    if (req.body.donor && req.body.donor.length > 0) {
      let donor = await User.findOne({
        where: {
          username: req.body.donor
        }
      })
      if (!donor) {
        req.flash('is-danger', 'Donor does not exist, try again')
        return res.redirect(`/admin/domains/${domain.domain}`)
      }
      domain.donor = donor
    }

    await domain.save()

    req.flash('is-success', 'Domain updated successfully')
    res.redirect(`/admin/domains/${domain.domain}`)
  })

AdminRouter.route('/domains/:domain/delete').get(async (req, res) => {
  const domain = await Domain.findOne({
    where: {
      domain: req.params.domain
    }
  })
  if (!domain) {
    req.flash('is-danger', 'Domain does not exist')
    return res.redirect('/admin/domains')
  }
  await domain.remove()
  req.flash('is-success', `Domain ${domain.domain} removed successfully`)
  return res.redirect('/admin/domains')
})

AdminRouter.route('/banners').get(async (req, res) => {
  let _banners = await Banner.find({})
  let banners = _banners.map(banner => banner.serialize())
  return res.render('pages/admin/banners/index', {
    layout: 'layouts/admin',
    banners
  })
})
AdminRouter.route('/banners/create')
  .get((req, res) => {
    return res.render('pages/admin/banners/create', {
      layout: 'layouts/admin'
    })
  })
  .post(async (req, res) => {
    let banner = new Banner()
    banner.id = randomUserId()
    banner.enabled = req.body.enabled === 'on' ? true : false
    banner.class = req.body.class
    banner.message = req.body.message
    await banner.save()
    return res.redirect(`/admin/banners/${banner.id}`)
  })

AdminRouter.route('/banners/:id')
  .get(async (req, res) => {
    let banner = await Banner.findOne({
      where: {
        id: req.params.id
      }
    })
    return res.render('pages/admin/banners/banner', {
      layout: 'layouts/admin',
      banner: banner!.serialize()
    })
  })
  .post(async (req, res) => {
    let banner = await Banner.findOne({
      where: {
        id: req.params.id
      }
    })
    if (!banner) {
      return res.redirect('/admin/banners')
    }
    banner.class = req.body.class || banner.class
    banner.message = req.body.message || banner.message
    banner.enabled = req.body.enabled
      ? req.body.enabled === 'on'
        ? true
        : false
      : false
    await banner.save()
    req.flash('is-success', 'Banner successfully updated')
    return res.redirect(`/admin/banners/${req.params.id}`)
  })

AdminRouter.route('/banners/:id/delete').get(async (req, res) => {
  let banner = await Banner.findOne({
    where: {
      id: req.params.id
    }
  })
  if (!banner) {
    req.flash('is-danger', 'Banner does not exist')
    return res.redirect('/admin/banners')
  }
  await banner.remove()
  req.flash('is-success', 'Banner deleted')
  return res.redirect('/admin/banners')
})
export default AdminRouter
