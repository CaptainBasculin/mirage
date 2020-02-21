import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { Domain } from '../database/entities/Domain'

const DomainsRouter = express.Router()
DomainsRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)

DomainsRouter.route('/').get(async (req, res) => {
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
  res.render('pages/domains/index', {
    domains
  })
})

export default DomainsRouter
