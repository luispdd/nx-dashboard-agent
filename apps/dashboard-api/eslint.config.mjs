import playwright from "eslint-plugin-playwright";
import baseConfig from "../../eslint.config.mjs";

export default [
    ...baseConfig,
    {
        files: [
            "**/*.ts",
            "**/*.js"
        ],
        // Override or add rules here
        rules: {}
    },
    {
        ...playwright.configs["flat/recommended"],
        files: ["e2e/**/*.{ts,js}"]
    }
];
