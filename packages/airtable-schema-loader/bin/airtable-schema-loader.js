#!/usr/bin/env node

const program = require('commander')
const fs = require('fs')
const { printSchema } = require('graphql')
const { fetchFromAirtable, createSchema, createResolvers } = require('../lib')
const { version, description } = require('../package.json')

require('dotenv').config()

program
  .version(version)
  .description(description)
  .arguments('[base]')
  .option('-u,--user <email>', 'airtable username')
  .option('-p,--password <password>', 'airtable password')
  .option('-o,--output <filename>', 'output file name', 'schema')
  .action(
    async (
      base = process.env.AIRTABLE_BASE_ID,
      {
        user: email = process.env.AIRTABLE_USER,
        password = process.env.AIRTABLE_PASSWORD,
        output: filename,
      }
    ) => {
      const result = await fetchFromAirtable({ email, password, base })

      fs.writeFileSync(filename + '.json', JSON.stringify(result, null, 2))
      fs.writeFileSync(filename + '.graphql', printSchema(createSchema(result)))
      fs.writeFileSync(filename + '.js', createResolvers(result))
    }
  )

program.parse(process.argv)
