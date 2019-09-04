import puppeteer from 'puppeteer'
import { prompt } from 'inquirer'
import { singular } from 'pluralize'
import prettier from 'prettier'
import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLID,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLList,
  GraphQLString,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLEnumType,
  GraphQLSchema,
} from 'graphql'
import {
  AirtableBase,
  AirtableTable,
  AirtableColumn,
  AirtableAttachment,
  AirtableCollaborator,
  AirtableInputAttachment,
  AirtableInputCollaborator,
} from './airtable'
import { toType, toField } from './sanitize'

interface Options {
  email: string
  password: string
  base: string
}

export async function fetchSchema(options: Options): Promise<AirtableBase> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  await page.goto(`https://airtable.com/${options.base}/api/docs`)
  await page.type('*[name=email]', options.email)
  await page.type('*[name=password]', options.password)
  await page.keyboard.press('Enter')
  await page.waitForNavigation()

  const tables: AirtableTable[] = await page.evaluate(() =>
    // @ts-ignore
    application.tables.map(table => ({
      name: table.name,
      columns: table.columns.map(column => ({
        name: column.name,
        type: column.type,
        options:
          column.type === 'select'
            ? {
                choices: Object.values(column.typeOptions.choices).map(
                  (choice: any) => choice.name
                ),
              }
            : column.type === 'foreignKey'
            ? {
                relationship: column.typeOptions.relationship,
                table: column.foreignTable.name,
              }
            : column.type === 'multiSelect'
            ? {
                choices: Object.values(column.typeOptions.choices).map(
                  (choice: any) => choice.name
                ),
              }
            : column.type === 'number'
            ? {
                format: column.typeOptions.format,
                symbol: column.typeOptions.symbol,
              }
            : {},
      })),
    }))
  )

  await browser.close()

  return { id: options.base, tables }
}

export async function fetchFromAirtable(options: Partial<Options>) {
  const questions = [
    {
      name: 'email',
      message: 'Your email address: ',
      type: 'input',
    },
    {
      name: 'password',
      message: 'Your password: ',
      type: 'password',
    },
    {
      name: 'base',
      message: 'The airtable base: ',
      type: 'input',
    },
  ]

  const unAnsweredQuestions = questions.filter(
    question => !options[question.name]
  )

  if (unAnsweredQuestions.length) {
    Object.assign(options, await prompt(unAnsweredQuestions))
  }

  return fetchSchema(options as any)
}

export function createSchema(base: AirtableBase) {
  const TYPES: Record<string, GraphQLObjectType> = {}

  base.tables.forEach(table => {
    TYPES[table.name] = new GraphQLObjectType({
      name: toType(table.name),
      fields: () =>
        table.columns.reduce(
          (acc, column) => {
            acc[toField(column.name)] = createGraphQLType(column, TYPES)

            return acc
          },
          {
            _id: { type: GraphQLID, description: 'Unique ID of the record' },
            _createdAt: {
              type: GraphQLString,
              description: 'UTC time at the record creation.',
            },
          }
        ),
    })
  })

  const GraphQLSortDirection = new GraphQLEnumType({
    name: 'order_by',
    values: {
      asc: {
        value: 'asc',
      },
      desc: {
        value: 'desc',
      },
    },
  })

  const query = new GraphQLObjectType({
    name: 'query_root',
    fields: base.tables.reduce((acc, table) => {
      const fieldName = toField(table.name)
      const fieldType = TYPES[table.name]

      acc[fieldName] = {
        type: new GraphQLList(fieldType),
        args: {
          limit: { type: GraphQLInt },
          offset: { type: GraphQLInt },
          filter_by_formula: { type: GraphQLString },
          order_by: {
            type: new GraphQLInputObjectType({
              name: `${singular(fieldType.name)}_order_by`,
              fields: table.columns.reduce(
                (acc, column) => {
                  acc[toField(column.name)] = { type: GraphQLSortDirection }

                  return acc
                },
                { id: { type: GraphQLSortDirection } }
              ),
            }),
          },
        },
      }

      acc[`${singular(fieldName)}_by_pk`] = {
        type: TYPES[table.name],
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
        },
      }

      return acc
    }, {}),
  })

  const mutation = new GraphQLObjectType({
    name: 'mutation_root',
    fields: base.tables.reduce((acc, table) => {
      const fieldName = toField(table.name)
      const fieldType = TYPES[table.name]
      const fieldTypeInput = new GraphQLInputObjectType({
        name: `${singular(fieldType.name)}_fields`,
        fields: () =>
          table.columns.reduce((acc, column) => {
            acc[toField(column.name)] = createGraphQLType(column, TYPES, true)

            return acc
          }, {}),
      })

      acc[`insert_${singular(fieldName)}`] = {
        type: fieldType,
        args: {
          fields: { type: fieldTypeInput },
        },
      }

      acc[`update_${singular(fieldName)}`] = {
        type: fieldType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          fields: { type: fieldTypeInput },
        },
      }

      acc[`delete_${singular(fieldName)}`] = {
        type: GraphQLBoolean,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
        },
      }

      return acc
    }, {}),
  })

  return new GraphQLSchema({ query, mutation })
}

function createGraphQLType(
  column: AirtableColumn,
  TYPES: Record<string, GraphQLObjectType>,
  isInputType: boolean = false
) {
  switch (column.type) {
    case 'autoNumber':
    case 'count':
    case 'rating':
      return { type: GraphQLInt }
    case 'collaborator':
      return {
        type: isInputType ? AirtableInputCollaborator : AirtableCollaborator,
      }
    case 'multipleAttachment':
      return {
        type: new GraphQLList(
          isInputType ? AirtableInputAttachment : AirtableAttachment
        ),
      }
    case 'checkbox':
      return { type: GraphQLBoolean }
    case 'foreignKey':
      const ForeignKeyType = TYPES[column.options.table]
      return {
        type:
          column.options.relation === 'many'
            ? new GraphQLList(ForeignKeyType)
            : ForeignKeyType,
      }
    case 'number':
      return {
        type: /^(currency|percentage|percentageV2|duration)$/.test(
          column.options.format
        )
          ? GraphQLString
          : column.options.format === 'decimal'
          ? GraphQLFloat
          : GraphQLInt,
      }
    case 'multiSelect':
      return { type: new GraphQLList(GraphQLString) }
    default:
      return { type: GraphQLString }
  }
}

function getColumnResolver(api: any, table: string, column: AirtableColumn) {
  switch (column.type) {
    case 'checkbox':
      return obj => obj._rawJson.fields[column.name] || false
    case 'foreignKey':
      return obj => {
        const ids = obj._rawJson.fields[column.name]

        if (column.options.relation === 'one') {
          if (!ids) return null
          return api.find(table, ids)
        } else {
          if (!Array.isArray(ids)) return []
          if (!ids.length) return []
          return Promise.all(ids.map(id => api.find(table, id)))
        }
      }
    case 'number':
      return obj => {
        const value = obj._rawJson.fields[column.name]

        if (column.options.format === 'currency') {
          return `${column.options.symbol}${value}`
        }

        if (
          column.options.format === 'percent' ||
          column.options.format === 'percentV2'
        ) {
          return `${value}%`
        }

        return value
      }
    case 'multiSelect':
      return obj => obj._rawJson.fields[column.name] || []
    default:
      return obj => obj._rawJson.fields[column.name]
  }
}

export function createResolvers(base: AirtableBase) {
  const types: string[] = []
  const queries: string[] = []
  const mutations: string[] = []

  const e = JSON.stringify

  base.tables.forEach(table => {
    const name = toField(table.name)
    types.push(`${toType(table.name)}: {
      _id: obj => obj.id,
      _createdAt: obj => obj._rawJson.createdTime,
      ${table.columns
        .map(
          column =>
            `${toField(column.name)}: getColumnResolver(api, ${e(
              table.name
            )}, ${e(column)})`
        )
        .join(',\n')}
    },`)
    queries.push(
      `${name}: (_, args) => api.select(${e(table.name)}, args),`,
      `${singular(name)}_by_pk: (_, args) => api.find(${e(
        table.name
      )}, args),`
    )
    mutations.push(
      `insert_${singular(name)}: (_, args) => api.create(${e(
        table.name
      )}, args),`,
      `update_${singular(name)}: (_, args) => api.update(${e(
        table.name
      )},args),`,
      `delete_${singular(name)}: (_, args) => api.remove(${e(
        table.name
      )}, args),`
    )
  })

  return prettier.format(
    `export default function createResolvers(instance) {
      const _base = instance.base(${e(base.id)})
      const _tables = {}
      const db = name => (
        _tables[name] || (_tables[name] = _base(name))
      )
      const _columns = {${base.tables.map(
        table => `${e(table.name)}: {${table.columns.map(column => `${toField(column.name)}: ${e(column.name)},`).join('\n')}},`
      ).join('\n')}}
      const api = {
        select(tableName, { limit: pageSize = 100, offset = 0, filter_by_formula: filterByFormula = '', order_by: sort = {} }) {
          return db(tableName).select({ pageSize, filterByFormula, sort: Object.entries(sort).map(([field, direction]) => ({ field, direction })) }).firstPage()
        },
        find(tableName, { id }) {
          return db(tableName).find(id)
        },
        create(tableName, { fields = {} }) {
          return db(tableName).create(Object.entries(fields).reduce((acc, [key, value]) => (acc[_columns[tableName][key]] = value, acc), {}))
        },
        update(tableName, { id, fields = {} }) {
          return db(tableName).update(id, Object.entries(fields).reduce((acc, [key, value]) => (acc[_columns[tableName][key]] = value, acc), {}))
        },
        remove(tableName, { id }) {
          return db(tableName).destroy(id).then(
            result => result.destroyed
          ).catch(() => false)
        }
      }
      function createGetter(name) {
        return obj => obj[name]
      }

      ${getColumnResolver.toString()}

      return {
        query_root: {
          ${queries.join('\n')}
        },
        mutation_root: {
          ${mutations.join('\n')}
        },
        airtable_attachment_thumbnail: {
          url: createGetter('url'),
          height: createGetter('height'),
          width: createGetter('width'),
        },
        airtable_attachment_thumbnail_group: {
          small: createGetter('small'),
          large: createGetter('large'),
        },
        airtable_attachment: {
          id: createGetter('id'),
          size: createGetter('size'),
          url: createGetter('url'),
          type: createGetter('type'),
          filename: createGetter('filename'),
          thumbnails: createGetter('thumbnails'),
        },
        airtable_collaborator: {
          id: createGetter('id'),
          email: createGetter('email'),
          name: createGetter('name'),
        },
        ${types.join('\n')}
      }
    }`,
    { parser: 'babel', singleQuote: true, trailingComma: 'es5' }
  )
}
