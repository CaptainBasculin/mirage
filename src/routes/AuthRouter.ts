import express from 'express'
import { User } from '../database/entities/User'
import argon2 from 'argon2'
import bodyParser from 'body-parser'
import { randomUserId, randomKey } from '../utils/RandomUtil'
import sgMail from '@sendgrid/mail'
import { Invite } from '../database/entities/Invite'
import { userCreated, userLogin } from '../bot'
import { increaseUser } from '../utils/SocketUtil'
import speakeasy from 'speakeasy'
const AuthRouter = express.Router()

AuthRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)

AuthRouter.route('/login')
  .get((req, res) => {
    res.render('pages/auth/login', {
      values: {},
      errors: {}
    })
  })
  .post(async (req, res) => {
    let errors: { [x: string]: string } = {}
    sgMail.setApiKey(process.env.EMAIL_KEY!)

    if (!req.body.username) {
      errors.username = 'Please specify a username'
    }
    if (!req.body.password) {
      errors.password = 'Please specify a password'
    }
    if (Object.keys(errors).length !== 0) {
      return res.render('pages/auth/login', {
        values: req.body,
        errors
      })
    }
    let user = await User.findOne({
      where: {
        [req.body.username.includes('@') ? 'email' : 'username']: req.body
          .username
      }
    })
    if (!user) {
      return res.render('pages/auth/login', {
        values: req.body,
        errors: {
          status: 'Username or password is incorrect'
        }
      })
    }

    let validPw = await argon2.verify(user.password, req.body.password)
    if (!validPw) {
      return res.render('pages/auth/login', {
        values: req.body,
        errors: {
          status: 'Username or password is incorrect'
        }
      })
    }

    if (user.suspended && !user.admin) {
      return res.render('pages/auth/login', {
        values: req.body,
        errors: {
          suspended: user.suspensionReason
        }
      })
    }

    if (user.mfa_enabled) {
      req.session!.user = user.id
      req.session!.ip = req.ip
      req.session!.mfa_jail = true
      req.session!.loggedIn = false
      return res.redirect('/auth/jail')
    }

    req.session!.user = user.id
    req.session!.loggedIn = true
    req.session!.ip = req.ip
    userLogin(user, req.ip, req.headers['user-agent'] || '')
    res.redirect('/')
  })

AuthRouter.route('/register')
  .get((req, res) => {
    res.render('pages/auth/register', {
      values: {},
      errors: {}
    })
  })
  .post(async (req, res) => {
    let errors: { [x: string]: string } = {}
    sgMail.setApiKey(process.env.EMAIL_KEY!)

    if (!req.body.username) {
      errors.username = 'Please specify a username'
    }
    if (!req.body.email) {
      errors.email = 'Please specify an email'
    }
    if (!req.body.password) {
      errors.password = 'Please specify a password'
    }
    if (!req.body.invite && !process.env.INVITES_DISABLED) {
      errors.invite = 'Please specify an invitation code'
    }
    if (!req.body.username.match(/^\w+$/i)) {
      errors.username =
        'Please specify a valid username (you may only use alphanumeric characters)'
    }
    let [_, usernames] = await User.findAndCount({
      where: {
        username: req.body.username
      }
    })
    let [__, emails] = await User.findAndCount({
      where: {
        email: req.body.email
      }
    })
    if (usernames !== 0) errors.username = 'Username already exists'
    if (emails !== 0) errors.email = 'Email already exists'

    if (Object.keys(errors).length !== 0) {
      return res.render('pages/auth/register', {
        values: req.body,
        errors
      })
    }
    if (!process.env.INVITES_DISABLED) {
      let invite = await Invite.findOne({
        where: {
          invite: req.body.invite,
          redeemed: false
        },
        relations: ['creator']
      })
      if (!invite) {
        return res.render('pages/auth/register', {
          values: req.body,
          errors: {
            invite: 'Invitation code is invalid'
          }
        })
      }
      if (invite.creator.suspended) {
        return res.render('pages/auth/register', {
          values: req.body,
          errors: {
            invite:
              'Invitation code is invalid because the creator was suspended'
          }
        })
      }
      invite.redeemed = true
      invite.redeemedBy = req.body.username
      await invite.save()
      sgMail.setApiKey(process.env.EMAIL_KEY!)
      await sgMail.send({
        to: invite.creator.email,
        from: process.env.EMAIL_FROM!,
        subject: 'Mirage: one of your invites was used',
        html: `Hello, ${invite.creator.username}!<br/>Someone used your invite: "${invite.invite}", and signed up with the username "${req.body.username}".`
      })
    }

    let user = new User()
    user.id = randomUserId()
    user.username = req.body.username
    user.email = req.body.email
    user.emailVerificationToken = randomKey()
    let pwHash = await argon2.hash(req.body.password)
    user.password = pwHash
    user.passwordResetToken = randomKey()
    user.uploadKey = randomKey()
    await user.save()
    await sgMail.send({
      to: user.email,
      from: process.env.EMAIL_FROM!,
      subject: 'Mirage: confirm your email',
      html: `Hello, ${user.username}!<br/>Someone signed up for an account with your email address (hopefully you!)<br/>Please confirm your email by pressing the link below.<br/><a href="${process.env.BASE_URL}/auth/confirm_email?key=${user.emailVerificationToken}">${process.env.BASE_URL}/auth/confirm_email?key=${user.emailVerificationToken}</a>`
    })
    userCreated(user)
    increaseUser()
    res.render('pages/auth/register_success')
  })

AuthRouter.route('/confirm_email').get(async (req, res) => {
  let user = await User.findOne({
    where: {
      emailVerificationToken: req.query.key
    }
  })
  if (!user) {
    return res.render('pages/auth/confirm_email', {
      error: 'Email verification token is invalid'
    })
  }
  user.emailVerified = true
  await user.save()
  return res.render('pages/auth/confirm_email')
})

AuthRouter.route('/forgot_password')
  .get((req, res) => {
    res.render('pages/auth/forgot_password', {
      values: {},
      errors: {}
    })
  })
  .post(async (req, res) => {
    let user = await User.findOne({
      where: {
        email: req.body.email
      }
    })
    if (!user) {
      return res.render('pages/auth/forgot_password', {
        values: req.body,
        errors: {
          email: 'Email does not exist'
        }
      })
    }
    if (user.suspended) {
      return res.render('pages/auth/forgot_password', {
        values: req.body,
        errors: {
          suspended: user.suspensionReason
        }
      })
    }
    user.passwordResetPending = true
    user.passwordResetToken = randomKey()
    await user.save()
    sgMail.setApiKey(process.env.EMAIL_KEY!)
    await sgMail.send({
      to: user.email,
      from: process.env.EMAIL_FROM!,
      subject: 'Mirage: someone requested a password reset',
      html: `Hello, ${user.username}!<br/>Someone requested a password reset for your account (hopefully you!)<br/>Please reset your password by clicking the link below.<br/><a href="${process.env.BASE_URL}/auth/forgot_password_prompt?key=${user.passwordResetToken}">${process.env.BASE_URL}/auth/forgot_password_prompt?key=${user.passwordResetToken}</a><br/>If this was not you, ignore this email.`
    })
    return res.render('pages/auth/forgot_password_success')
  })

AuthRouter.route('/forgot_password_prompt')
  .get(async (req, res) => {
    let user = await User.findOne({
      where: {
        passwordResetToken: req.query.key
      }
    })
    if (!user) {
      return res.render('pages/auth/forgot_password_prompt', {
        values: {},
        errors: {
          tokenInvalid: true
        },
        key: req.query.key
      })
    }
    return res.render('pages/auth/forgot_password_prompt', {
      values: {},
      errors: {},
      key: req.query.key
    })
  })
  .post(async (req, res) => {
    let user = await User.findOne({
      where: {
        passwordResetToken: req.body.key
      }
    })
    if (!user) {
      return res.render('pages/auth/forgot_password_prompt', {
        values: {},
        errors: {
          tokenInvalid: true
        },
        key: req.body.key
      })
    }
    if (req.body.password !== req.body.confirmPassword) {
      return res.render('pages/auth/forgot_password_prompt', {
        values: {},
        errors: {
          confirmPassword: 'Passwords do not match'
        },
        key: req.body.key
      })
    }

    let hash = await argon2.hash(req.body.password)
    user.password = hash
    user.passwordResetPending = true
    user.passwordResetToken = randomKey()
    await user.save()
    return res.render('pages/auth/forgot_password_prompt_success')
  })

AuthRouter.route('/logout').get((req, res) => {
  delete req.user
  delete req.session!.user
  req.session!.mfa_jail = undefined
  req.session!.loggedIn = false
  return res.redirect('/')
})

AuthRouter.route('/jail').get((req, res) => {
  if (req.loggedIn) {
    return res.redirect('/account')
  }
  return res.render('pages/auth/mfa_totp')
})

AuthRouter.route('/jail/totp').post(async (req, res) => {
  let user = req.user
  if (!user.mfa_totp_enabled) {
    req.flash('is-danger', 'TOTP not enabled')
    return res.redirect('/auth/jail')
  }
  let secret = user.mfa_totp_secret!
  let valid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: req.body.mfa_code
  })
  if (!valid) {
    req.flash('is-danger', '2FA code is not valid, try again')
    return res.redirect('/auth/jail')
  }
  req.session!.user = user.id
  req.session!.loggedIn = true
  req.session!.ip = req.ip
  req.flash('is-success', 'Logged in successfully')
  return res.redirect('/account')
})
AuthRouter.route('/jail/disable')
  .get((req, res) => {
    if (req.loggedIn) {
      return res.redirect('/account')
    }
    return res.render('pages/auth/mfa_disable')
  })
  .post(async (req, res) => {
    let user = req.user

    let valid = user.mfa_recovery_code! === req.body.recovery_code
    if (!valid) {
      req.flash('is-danger', 'Recovery code is invalid')
      return res.redirect('/auth/jail')
    }
    req.session!.user = user.id
    req.session!.loggedIn = true
    req.session!.ip = req.ip
    req.user.mfa_enabled = false
    req.user.mfa_totp_enabled = false
    await req.user.save()
    req.flash('is-warning', '2FA was disabled, please re-configure it')
    req.flash('is-success', 'Logged in successfully')
    return res.redirect('/account/mfa')
  })
export default AuthRouter
