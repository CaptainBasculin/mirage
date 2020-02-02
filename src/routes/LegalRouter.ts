import express from 'express'
import bodyParser from 'body-parser'
import fetch from 'node-fetch'
import { Report } from '../database/entities/Report'
import { randomUserId } from '../utils/RandomUtil'
import { Image } from '../database/entities/Image'
import querystring from 'querystring'
import { reportSubmitted } from '../bot'
async function verifyCaptcha(response: string, ip: string): Promise<Boolean> {
  try {
    const resp = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        body: querystring.encode({
          secret: process.env.RECAPTCHA_SECRETKEY,
          response,
          remoteip: ip
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST'
      }
    )
    const res = await resp.json()
    return res.success
  } catch (err) {
    return false
  }
}

const LegalRouter = express.Router()
LegalRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)
LegalRouter.route(['/terms', '/tos']).get((req, res) => {
  res.render('pages/legal/terms')
})

LegalRouter.route(['/privacy', '/privacypolicy', '/privacy_policy']).get(
  (req, res) => {
    res.render('pages/legal/privacy')
  }
)

LegalRouter.route('/report')
  .get((req, res) => {
    return res.render('pages/legal/report', {
      siteKey: process.env.RECAPTCHA_SITEKEY
    })
  })
  .post(async (req, res) => {
    const response = req.body['g-recaptcha-response']
    if (!response) {
      return res.render('pages/legal/report', {
        siteKey: process.env.RECAPTCHA_SITEKEY,
        captcha: 'Not solved'
      })
    }
    const captchaVerified = await verifyCaptcha(response, req.ip)
    if (!captchaVerified) {
      return res.render('pages/legal/report', {
        siteKey: process.env.RECAPTCHA_SITEKEY,
        captcha: 'Invalid captcha'
      })
    }

    if (!req.body.image) {
      return res.render('pages/legal/report', {
        siteKey: process.env.RECAPTCHA_SITEKEY,
        image: 'Invalid image id'
      })
    }

    if (!req.body.reason) {
      return res.render('pages/legal/report', {
        siteKey: process.env.RECAPTCHA_SITEKEY,
        reason: 'Invalid reason'
      })
    }

    let tmpArr = req.body.image.split('/')
    let shortId = tmpArr[tmpArr.length - 1].split('.')[0]

    const image = await Image.findOne({
      where: {
        shortId
      }
    })

    if (!image) {
      return res.render('pages/legal/report', {
        siteKey: process.env.RECAPTCHA_SITEKEY,
        image: 'Image does not exist'
      })
    }

    const report = new Report()
    report.id = randomUserId()
    report.image = image
    report.reporterIp = req.ip
    report.resolved = false
    report.reason = req.body.reason
    report.createdOn = new Date()
    await report.save()
    await reportSubmitted(report)
    return res.render('pages/legal/report_success', {
      id: report.id
    })
  })

export default LegalRouter
