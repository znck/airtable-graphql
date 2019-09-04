import camelCase from 'camelcase'

function normalize(str: string) {
  return str.replace(/\W/g, '')
}

export function toType(name: string) {
  return normalize(name)
}

export function toField(name: string) {
  return camelCase(normalize(name))
}
