const { createJiti } = require('jiti');
const jiti = createJiti(__filename);
jiti('./etl-cli.ts');
