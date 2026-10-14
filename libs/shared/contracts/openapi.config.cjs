const { HttpResourcePlugin } = require('@ng-openapi/http-resource');
const path = require('path');

module.exports = {
  input: path.resolve(__dirname, '../../../dist/apps/dashboard-api/openapi.json'),
  output: path.resolve(__dirname, './src/generated'),
  options: {
    dateType: 'string',
    enumStyle: 'enum',
  },
  plugins: [HttpResourcePlugin],
};
