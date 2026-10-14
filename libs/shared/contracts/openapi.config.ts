import { GeneratorConfig } from 'ng-openapi';
import { HttpResourcePlugin } from '@ng-openapi/http-resource';

const config: GeneratorConfig = {
  input: 'dist/apps/dashboard-api/openapi.json',
  output: 'libs/shared/contracts/src/generated',
  dateType: 'string',
  plugins: [HttpResourcePlugin],
};

export default config;
