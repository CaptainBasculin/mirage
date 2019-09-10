import express from 'express'
import { Invite } from '../database/entities/Invite'
import { randomUserId, randomKey } from '../utils/RandomUtil'
import randomstring from 'randomstring'
import bodyParser from 'body-parser'
import { Image } from '../database/entities/Image'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'
import { bucket } from '../utils/StorageUtil'
const AccountRouter = express.Router()
AccountRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
const BaseUploader = {
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
  Version: '13.0.1',
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
AccountRouter.route('/urlshortener')
  .get((req, res) => {
    res.render('pages/account/urlshortener', {
      layout: 'layouts/account'
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

AccountRouter.route('/sharex')
  .get((req, res) => {
    res.render('pages/account/sharex', {
      layout: 'layouts/account'
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
AccountRouter.route('/invites').get((req, res) => {
  res.render('pages/account/invites', {
    layout: 'layouts/account'
  })
})
AccountRouter.route('/invites/create').post(async (req, res) => {
  if (!req.user.admin) {
    return res.redirect('/account/invites')
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
        uploader: req.user.id
      }
    })
    await Promise.all(
      images.map(async image => {
        await bucket.file(image.path).delete()
        image.deleted = true
        image.deletionReason = 'USER'
        await image.save()
      })
    )
    return res.redirect('/account/images/nuke?stage=2')
  })

AccountRouter.route('/urls').get((req, res) => {
  res.locals.profile.urls = res.locals.profile.urls.reverse()
  res.render('pages/account/urls/index', {
    layout: 'layouts/account',
    urls: res.locals.profile.urls.filter((url: ShortenedUrl) => !url.deleted)
  })
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
        creator: req.user.id
      }
    })
    await Promise.all(
      urls.map(async url => {
        url.deleted = true
        url.deletionReason = 'USER'
        await url.save()
      })
    )
    return res.redirect('/account/urls/nuke?stage=2')
  })

export default AccountRouter
