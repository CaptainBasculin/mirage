import express from 'express'
const LegalRouter = express.Router()

LegalRouter.route(['/terms', '/tos']).get((req, res) => {
  res.render('pages/legal/terms')
})

LegalRouter.route(['/privacy', '/privacypolicy', '/privacy_policy']).get(
  (req, res) => {
    res.render('pages/legal/privacy')
  }
)

export default LegalRouter
