export interface AirtableBase {
  id: string
  tables: AirtableTable[]
}

export interface AirtableTable {
  name: string
  columns: AirtableColumn[]
}

export type AirtableColumn =
  | AirtableAttachmentColumn
  | AirtableAutoNumberColumn
  | AirtableCheckboxColumn
  | AirtableCollaboratorColumn
  | AirtableCountColumn
  | AirtableDateColumn
  | AirtableMultiSelectColumn
  | AirtableMultiSelectColumn
  | AirtableNumberColumn
  | AirtableRatingColumn
  | AirtableRelationColumn
  | AirtableSelectColumn
  | AirtableTextColumn

interface AbstractAirtableColumn {
  name: string
  type: string
}

export interface AirtableTextColumn extends AbstractAirtableColumn {
  type: 'text'
}
export interface AirtableAttachmentColumn extends AbstractAirtableColumn {
  type: 'multipleAttachment'
}
export interface AirtableAutoNumberColumn extends AbstractAirtableColumn {
  type: 'autoNumber'
}
export interface AirtableMultilineTextColumn extends AbstractAirtableColumn {
  type: 'multilineText'
}
export interface AirtableCountColumn extends AbstractAirtableColumn {
  type: 'count'
}
export interface AirtableRatingColumn extends AbstractAirtableColumn {
  type: 'rating'
}
export interface AirtableNumberColumn extends AbstractAirtableColumn {
  type: 'number'
  options: {
    format: string
    symbol: string
  }
}
export interface AirtableSelectColumn extends AbstractAirtableColumn {
  type: 'select'
  options: {
    choices: string[]
  }
}
export interface AirtableMultiSelectColumn extends AbstractAirtableColumn {
  type: 'multiSelect'
  options: {
    choices: string[]
  }
}
export interface AirtableCheckboxColumn extends AbstractAirtableColumn {
  type: 'checkbox'
}
export interface AirtableCollaboratorColumn extends AbstractAirtableColumn {
  type: 'collaborator'
}
export interface AirtableDateColumn extends AbstractAirtableColumn {
  type: 'date'
  options: {
    format: string
  }
}
export interface AirtableRelationColumn extends AbstractAirtableColumn {
  type: 'foreignKey'
  options: {
    relation: 'one' | 'many'
    table: string
  }
}

import {
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from 'graphql'

export const AirtableCollaborator = new GraphQLObjectType({
  name: 'airtable_collaborator',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    email: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: GraphQLString },
  },
})
export const AirtableInputCollaborator = new GraphQLInputObjectType({
  name: 'airtable_input_collaborator',
  fields: {
    email: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: GraphQLString },
  },
})

export const AirtableThumbnail = new GraphQLObjectType({
  name: 'airtable_attachment_thumbnail',
  fields: {
    url: { type: GraphQLString },
    height: { type: GraphQLInt },
    width: { type: GraphQLInt },
  },
})

export const AirtableInputThumbnail = new GraphQLInputObjectType({
  name: 'airtable_input_attachment_thumbnail',
  fields: {
    url: { type: GraphQLString },
    height: { type: GraphQLInt },
    width: { type: GraphQLInt },
  },
})

export const AirtableThumbnailGroup = new GraphQLObjectType({
  name: 'airtable_attachment_thumbnail_group',
  fields: {
    small: { type: AirtableThumbnail },
    large: { type: AirtableThumbnail },
  },
})
export const AirtableInputThumbnailGroup = new GraphQLInputObjectType({
  name: 'airtable_input_attachment_thumbnail_group',
  fields: {
    small: { type: AirtableInputThumbnail },
    large: { type: AirtableInputThumbnail },
  },
})

export const AirtableAttachment = new GraphQLObjectType({
  name: 'airtable_attachment',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    size: { type: GraphQLInt },
    url: { type: GraphQLString },
    type: { type: GraphQLString },
    filename: { type: GraphQLString },
    thumbnails: { type: AirtableThumbnailGroup },
  },
})
export const AirtableInputAttachment = new GraphQLInputObjectType({
  name: 'airtable_input_attachment',
  fields: {
    size: { type: GraphQLInt },
    url: { type: GraphQLString },
    type: { type: GraphQLString },
    filename: { type: GraphQLString },
    thumbnails: { type: AirtableInputThumbnailGroup },
  },
})
