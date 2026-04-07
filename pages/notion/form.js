import { bootstrapForm, getParams } from '/shared/form-utils.js'

const params = getParams()
if (params) {
  bootstrapForm(params, {
    successMessage: 'Credentials sent. Waiting for server...'
  })
}
