import express, { Request, Response } from 'express'
import { NextFunction } from 'connect'
import { Invite } from '../database/entities/Invite'
import { randomUserId, randomKey } from '../utils/RandomUtil'
import randomstring from 'randomstring'
import bodyParser from 'body-parser'
import { Image } from '../database/entities/Image'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'
import { bucket } from '../utils/StorageUtil'
import {
  sendImageNukeCompleted,
  sendURLNukeCompleted,
  sendPasteNukeComplete
} from '../bot'
import { rword } from 'rword'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import { Domain } from '../database/entities/Domain'
import crypto from 'crypto'
import { Paste } from '../database/entities/Paste'
import { getUserByUsername, linkUser } from '../utils/XfUtil'
const AccountRouter = express.Router()
AccountRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
const BaseUploader = {
  Version: '13.1.0',
  Name: 'Mirage ($user$ on host $host$)',
  DestinationType: 'ImageUploader, FileUploader',
  RequestURL: 'https://api.mirage.re/upload',
  FileFormName: 'file',
  Arguments: {
    key: '',
    host: ''
  }
}
const BaseUrlShortener = {
  Version: '13.1.0',
  Name: 'Mirage URL Shortener ($user$ on host $host$)',
  DestinationType: 'URLShortener',
  RequestMethod: 'POST',
  RequestURL: 'https://api.mirage.re/shorten',
  Body: 'FormURLEncoded',
  Arguments: {
    key: '',
    url: '$input$',
    host: ''
  }
}
const BasePasteUploader = {
  Version: '13.1.0',
  Name: 'Mirage Paste ($user$ on host $host$)',
  DestinationType: 'TextUploader',
  RequestMethod: 'POST',
  RequestURL: 'https://api.mirage.re/upload/paste',
  Body: 'MultipartFormData',
  Arguments: {
    key: '',
    host: ''
  },
  FileFormName: 'file',
  URL: '$json:url$'
}
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.redirect(`/auth/login?next=${req.originalUrl}`)
  }

  return next()
}
AccountRouter.use(authMiddleware)
AccountRouter.route('/').get((req, res) => {
  res.render('pages/account/index', {
    layout: 'layouts/account'
  })
})
AccountRouter.route('/regenerate_key').post(async (req, res) => {
  req.user.uploadKey = randomKey()
  await req.user.save()
  return res.redirect('/account')
})
AccountRouter.route('/secure_names').post(async (req, res) => {
  req.user.longNames = !req.user.longNames
  await req.user.save()
  return res.redirect('/account')
})
AccountRouter.route('/invisible_short_ids').post(async (req, res) => {
  req.user.invisibleShortIds = !req.user.invisibleShortIds
  await req.user.save()
  return res.redirect('/account')
})
AccountRouter.route('/urlshortener')
  .get(async (req, res) => {
    let _domains = await Domain.find({
      relations: ['donor']
    })

    const sortFn = (a: Domain, b: Domain) => {
      if (a.domain < b.domain) {
        return -1
      }
      if (a.domain > b.domain) {
        return 1
      }
      return 0
    }

    let official = _domains.filter(domain => !domain.donor).sort(sortFn)
    let donor = _domains.filter(domains => domains.donor).sort(sortFn)

    let domains = official.concat(donor)
    res.render('pages/account/urlshortener', {
      layout: 'layouts/account',
      domains
    })
  })
  .post((req, res) => {
    let cfg = {
      ...BaseUrlShortener,
      Name: `Mirage URL Shortener (${req.user.username} on ${req.body.host})`,
      Arguments: {
        key: req.user.uploadKey,
        host: req.body.host,
        url: '$input$'
      }
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=mirage_sharex_url_shortener_${req.user.username}_on_${req.body.host}.sxcu`
    )
    res.setHeader('Content-Transfer-Encoding', 'binary')
    res.setHeader('Content-Type', 'application/octet-stream')
    return res.send(JSON.stringify(cfg))
  })

AccountRouter.route('/discord').get((req, res) => {
  res.render('pages/account/discord', {
    layout: 'layouts/account'
  })
})

AccountRouter.route('/random')
  .get(async (req, res) => {
    let _domains = await Domain.find({
      relations: ['donor']
    })

    const sortFn = (a: Domain, b: Domain) => {
      if (a.domain < b.domain) {
        return -1
      }
      if (a.domain > b.domain) {
        return 1
      }
      return 0
    }

    let official = _domains.filter(domain => !domain.donor).sort(sortFn)
    let donor = _domains.filter(domains => domains.donor).sort(sortFn)

    let domains = official.concat(donor)

    res.render('pages/account/random', {
      layout: 'layouts/account',
      domains
    })
  })
  .post(async (req, res) => {
    const domains = req.body.domains.split(';')
    req.user.randomDomains = domains
    await req.user.save()
    req.flash('is-success', 'Random domains updated successfully')
    return res.redirect('/account/random')
  })

AccountRouter.route('/sharex')
  .get(async (req, res) => {
    let _domains = await Domain.find({
      relations: ['donor']
    })

    const sortFn = (a: Domain, b: Domain) => {
      if (a.domain < b.domain) {
        return -1
      }
      if (a.domain > b.domain) {
        return 1
      }
      return 0
    }

    let official = _domains.filter(domain => !domain.donor).sort(sortFn)
    let donor = _domains.filter(domains => domains.donor).sort(sortFn)

    let domains = official.concat(donor)
    res.render('pages/account/sharex', {
      layout: 'layouts/account',
      domains
    })
  })
  .post((req, res) => {
    let cfg = {
      ...BaseUploader,
      Name: `Mirage (${req.user.username} on ${req.body.host})`,
      Arguments: {
        key: req.user.uploadKey,
        host: req.body.host
      }
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=mirage_sharex_${req.user.username}_on_${req.body.host}.sxcu`
    )
    res.setHeader('Content-Transfer-Encoding', 'binary')
    res.setHeader('Content-Type', 'application/octet-stream')
    return res.send(JSON.stringify(cfg))
  })
AccountRouter.route('/sharexpaste')
  .get(async (req, res) => {
    let _domains = await Domain.find({
      relations: ['donor']
    })

    const sortFn = (a: Domain, b: Domain) => {
      if (a.domain < b.domain) {
        return -1
      }
      if (a.domain > b.domain) {
        return 1
      }
      return 0
    }

    let official = _domains.filter(domain => !domain.donor).sort(sortFn)
    let donor = _domains.filter(domains => domains.donor).sort(sortFn)

    let domains = official.concat(donor)
    res.render('pages/account/sharexpaste', {
      layout: 'layouts/account',
      domains
    })
  })
  .post((req, res) => {
    let cfg = {
      ...BasePasteUploader,
      Name: `Mirage Paste (${req.user.username} on ${req.body.host})`,
      Arguments: {
        key: req.user.uploadKey,
        host: req.body.host
      }
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=mirage_sharex_paste_${req.user.username}_on_${req.body.host}.sxcu`
    )
    res.setHeader('Content-Transfer-Encoding', 'binary')
    res.setHeader('Content-Type', 'application/octet-stream')
    return res.send(JSON.stringify(cfg))
  })
AccountRouter.route('/invites').get((req, res) => {
  res.render('pages/account/invites', {
    layout: 'layouts/account'
  })
})
AccountRouter.route('/invites/create').post(async (req, res) => {
  if (
    !req.user.admin &&
    !req.user.moderator &&
    !req.user.inviteCreator &&
    (req.user.availableInvites || 0) < 1
  ) {
    return res.redirect('/account/invites')
  }
  if (req.user.inviteBanned) {
    req.flash(
      'is-danger',
      'You were invite banned and cannot create new invites'
    )
    return res.redirect('/account/invites')
  }
  if (!req.user.admin || !req.user.moderator || !req.user.inviteCreator) {
    req.user.availableInvites = req.user.availableInvites - 1
    await req.user.save()
  }
  let invite = new Invite()
  invite.id = randomUserId()
  invite.invite = randomstring.generate({
    length: 40,
    charset: 'alphanumeric'
  })
  invite.creator = req.user
  invite.createdOn = new Date()
  await invite.save()
  return res.redirect('/account/invites')
})

AccountRouter.route('/pastes').get(async (req, res) => {
  //res.locals.profile.pastes = (res.locals.profile.pastes || []).reverse()
  let pastes = await Paste.find({
    where: {
      uploader: req.user.id
    }
  })
  pastes = pastes.reverse().filter(paste => !paste.deleted)
  res.render('pages/account/pastes/index', {
    layout: 'layouts/account',
    pastes
  })
})
const PASTE_DELETE_CONTENT = Buffer.from('deleted').toString('base64')
AccountRouter.route('/pastes/nuke')
  .get((req, res) => {
    res.render('pages/account/pastes/nuke', {
      layout: 'layouts/account',
      stage: parseInt(req.query.stage || '0')
    })
  })
  .post(async (req, res) => {
    let stage = parseInt(req.body.stage)
    console.log(stage)
    if (stage === 0) {
      return res.redirect('/account/pastes/nuke?stage=1')
    }
    let pastes = await Paste.find({
      where: {
        uploader: req.user.id,
        deleted: false
      }
    })
    Promise.all(
      pastes.map(async paste => {
        paste.deleted = true
        paste.deletionReason = 'USER'
        paste.content = PASTE_DELETE_CONTENT
        await paste.save()
      })
    ).then(async () => {
      await sendPasteNukeComplete(req.user, pastes.length)
    })
    return res.redirect('/account/pastes/nuke?stage=2')
  })
AccountRouter.route('/pastes/:id/delete').get(async (req, res) => {
  let paste = await Paste.findOne({
    where: {
      id: req.params.id,
      uploader: req.user.id
    }
  })
  if (!paste) {
    req.flash('is-danger', 'No access')
    return res.redirect('/account/pastes')
  }
  paste.deleted = true
  paste.deletionReason = 'USER'
  paste.content = PASTE_DELETE_CONTENT
  await paste.save()
  req.flash('is-success', `Paste ${paste.shortId} was deleted`)
  return res.redirect(`/account/pastes`)
})
AccountRouter.route('/images').get((req, res) => {
  res.locals.profile.images = res.locals.profile.images.reverse()
  res.render('pages/account/images/index', {
    layout: 'layouts/account',
    images: res.locals.profile.images.filter((image: Image) => !image.deleted)
  })
})
AccountRouter.route('/images/nuke')
  .get((req, res) => {
    res.render('pages/account/images/nuke', {
      layout: 'layouts/account',
      stage: parseInt(req.query.stage || '0')
    })
  })
  .post(async (req, res) => {
    let stage = parseInt(req.body.stage)
    console.log(stage)
    if (stage === 0) {
      return res.redirect('/account/images/nuke?stage=1')
    }
    let images = await Image.find({
      where: {
        uploader: req.user.id,
        deleted: false
      }
    })
    Promise.all(
      images.map(async image => {
        await bucket.file(image.path).delete()
        image.deleted = true
        image.deletionReason = 'USER'
        await image.save()
      })
    ).then(async () => {
      await sendImageNukeCompleted(req.user, images.length)
    })
    return res.redirect('/account/images/nuke?stage=2')
  })
AccountRouter.route('/images/:id/delete').get(async (req, res) => {
  let image = await Image.findOne({
    where: {
      id: req.params.id,
      uploader: req.user.id
    }
  })
  if (!image) {
    req.flash('is-danger', 'No access')
    return res.redirect('/account/images')
  }
  await bucket.file(image.path).delete()
  image.deleted = true
  image.deletionReason = 'USER'
  await image.save()
  req.flash('is-success', `Image ${image.path} was deleted`)
  return res.redirect(`/account/images`)
})
AccountRouter.route('/urls').get((req, res) => {
  res.locals.profile.urls = res.locals.profile.urls.reverse()
  res.render('pages/account/urls/index', {
    layout: 'layouts/account',
    urls: res.locals.profile.urls.filter((url: ShortenedUrl) => !url.deleted)
  })
})
AccountRouter.route('/urls/:id/delete').get(async (req, res) => {
  let url = await ShortenedUrl.findOne({
    where: {
      id: req.params.id,
      creator: req.user.id
    }
  })
  if (!url) {
    req.flash('is-danger', 'No access')
    return res.redirect('/account/urls')
  }
  url.deleted = true
  url.deletionReason = 'USER'
  await url.save()
  req.flash('is-success', `URL ${url.shortId} was deleted`)

  return res.redirect(`/account/urls`)
})
AccountRouter.route('/urls/nuke')
  .get((req, res) => {
    res.render('pages/account/urls/nuke', {
      layout: 'layouts/account',
      stage: parseInt(req.query.stage || '0')
    })
  })
  .post(async (req, res) => {
    let stage = parseInt(req.body.stage)
    console.log(stage)
    if (stage === 0) {
      return res.redirect('/account/urls/nuke?stage=1')
    }
    let urls = await ShortenedUrl.find({
      where: {
        creator: req.user.id,
        deleted: false
      }
    })
    Promise.all(
      urls.map(async url => {
        url.deleted = true
        url.deletionReason = 'USER'
        await url.save()
      })
    ).then(async () => {
      await sendURLNukeCompleted(req.user, urls.length)
    })
    return res.redirect('/account/urls/nuke?stage=2')
  })

AccountRouter.route('/upload').get((req, res) => {
  return res.render('pages/account/upload', {
    layout: 'layouts/account'
  })
})

/* forums */
AccountRouter.route('/forums')
  .get((req, res) => {
    return res.render('pages/account/forums', {
      layout: 'layouts/account'
    })
  })
  .post(async (req, res) => {
    const xfUser = await getUserByUsername(req.body.username)
    if (!xfUser) {
      req.flash('is-danger', 'That user does not exist on the forums.')
      return res.redirect('/account/forums')
    }

    const success = await linkUser(req.user, req.body.username)
    if (!success) {
      req.flash(
        'is-danger',
        'Failed to link your account on the forums. Please contact a developer.'
      )
    } else {
      req.flash('is-success', 'Linked your account on the forums successfully.')
    }
    return res.redirect('/account/forums')
  })

/* 2fa */
AccountRouter.route('/mfa').get(async (req, res) => {
  if (!req.user.mfa_enabled) {
    let secret = speakeasy.generateSecret({
      issuer: 'mirage',
      name: `Mirage (${req.user.username})`
    })
    req.session!.mfa_temp_secret = secret.base32
    let url = await qrcode.toDataURL(secret.otpauth_url!)
    return res.render('pages/account/mfa/index', {
      layout: 'layouts/account',
      secret: secret.base32,
      qrcode: url
    })
  }
  return res.render('pages/account/mfa/index', { layout: 'layouts/account' })
})

AccountRouter.route('/mfa/u2f').get((req, res) => {
  const challenge = crypto.randomBytes(32).toJSON()
  return res.render('pages/account/mfa/u2f', {
    layout: 'layouts/account',
    challenge,
    domain: process.env.WEBAUTHN_RPID
  })
})

AccountRouter.route('/mfa/confirm').post(async (req, res) => {
  let temp_secret = req.session!.mfa_temp_secret
  let validCode = speakeasy.totp.verify({
    secret: temp_secret,
    encoding: 'base32',
    token: req.body.mfa_code
  })
  if (!validCode) {
    res.locals.banners.push({
      class: 'is-warning',
      message: 'MFA code was invalid, try again'
    })
    let secret = speakeasy.generateSecret({
      issuer: 'mirage',
      name: `Mirage (${req.user.username})`
    })
    req.session!.mfa_temp_secret = secret.base32
    let url = await qrcode.toDataURL(secret.otpauth_url!)
    return res.render('pages/account/mfa/index', {
      layout: 'layouts/account',
      secret: secret.base32,
      qrcode: url
    })
  }
  let words = rword.generate(20) as string[]
  req.user.mfa_recovery_code = words.join(' ')
  await req.user.save()
  return res.render('pages/account/mfa/confirm', {
    layout: 'layouts/account',
    recoveryCode: req.user.mfa_recovery_code
  })
})

AccountRouter.route('/mfa/complete').get(async (req, res) => {
  if (req.user.mfa_enabled || req.user.mfa_totp_enabled) {
    return res.redirect('/account/mfa')
  }
  req.user.mfa_enabled = true
  req.user.mfa_totp_enabled = true
  req.user.mfa_totp_secret = req.session!.mfa_temp_secret
  await req.user.save()
  res.locals.banners.push({
    class: 'is-success',
    message: '2FA was successfully enabled'
  })
  return res.render('pages/account/mfa/complete', {
    layout: 'layouts/account'
  })
})

AccountRouter.route('/mfa/disable').post(async (req, res) => {
  if (!req.user.mfa_enabled) {
    req.flash('is-danger', '2FA not enabled')
    return res.redirect('/account/mfa')
  }
  if (req.user.mfa_recovery_code! !== req.body.recovery_code) {
    req.flash('is-danger', 'Recovery code invalid, try again')
    return res.redirect('/account/mfa')
  }
  req.user.mfa_enabled = false
  req.user.mfa_totp_enabled = false
  await req.user.save()
  req.flash('is-success', '2FA was disabled successfully')
  return res.redirect('/account/mfa')
})

export default AccountRouter
