module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',

  transform: {
    '^.+\\.ts$': 'ts-jest',

    '^.+\\.js$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
          checkJs: false,
          module: 'CommonJS',
          moduleResolution: 'Node',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },

  transformIgnorePatterns: [
    'node_modules[/\\\\](?!@nestjs[/\\\\]event-emitter[/\\\\])',
  ],

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^generated/(.*)$': '<rootDir>/generated/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
