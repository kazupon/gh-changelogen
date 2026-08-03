#!/usr/bin/env node
import { isCliValidationError, main } from './dist/cli.mjs'

main(process.argv.slice(2)).catch(error => {
  if (!isCliValidationError(error)) {
    console.error(error)
  }
  process.exitCode = 1
})
