const { createJiti } = require('jiti');
const jiti = createJiti(__filename);
jiti('./seed-cli.ts');
