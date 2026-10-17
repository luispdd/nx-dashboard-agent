import nx from "@nx/eslint-plugin";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    {
      "ignores": [
        "**/dist",
        "**/out-tsc",
        "**/.angular/**",
        "**/vitest.config.*.timestamp*",
        "**/vite.config.*.timestamp*",
        "libs/shared/contracts/src/generated/**",
        "**/src/generated/**"
      ]
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx"
        ],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [
                        "^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$"
                    ],
                    depConstraints: [
                        {
                            sourceTag: "scope:dashboard",
                            onlyDependOnLibsWithTags: [
                                "scope:dashboard",
                                "scope:shared"
                            ]
                        },
                        {
                            sourceTag: "scope:chat",
                            onlyDependOnLibsWithTags: [
                                "scope:chat",
                                "scope:shared"
                            ]
                        },
                        {
                            sourceTag: "scope:agent",
                            onlyDependOnLibsWithTags: [
                                "scope:agent",
                                "scope:shared"
                            ]
                        },
                        {
                            sourceTag: "scope:shared",
                            onlyDependOnLibsWithTags: [
                                "scope:shared"
                            ]
                        },
                        {
                            sourceTag: "type:app",
                            onlyDependOnLibsWithTags: [
                                "type:feature",
                                "type:ui",
                                "type:data-access",
                                "type:util",
                                "type:contracts"
                            ]
                        },
                        {
                            sourceTag: "type:contracts",
                            onlyDependOnLibsWithTags: [
                                "type:contracts",
                                "type:util"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs"
        ],
        // Override or add rules here
        rules: {}
    }
];
