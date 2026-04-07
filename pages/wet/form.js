import { bootstrapForm, getParams } from '/shared/form-utils.js'

const params = getParams()
if (params) {
  bootstrapForm(params, {
    skipOptions: { text: 'Skip (use local mode)', successMessage: 'Setup skipped. Using local ONNX models.' }
  })
}
