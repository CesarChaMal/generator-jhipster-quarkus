/* eslint-disable consistent-return */
const chalk = require('chalk');
const os = require('os');
const ServerGenerator = require('generator-jhipster/generators/server');
const { SERVER_TEST_RES_DIR } = require('generator-jhipster/generators/generator-constants');
const prompts = require('./prompts');
const writeFiles = require('./files').writeFiles;
const { QUARKUS_VERSION, CACHE_MAXIMUM_SIZE, CACHE_EXPIRE_AFTER_WRITE } = require('../generator-quarkus-constants');

module.exports = class extends ServerGenerator {
    constructor(args, options, features) {
        super(args, options, features);

        if (this.options.help) return;

        if (!this.options.jhipsterContext) {
            throw new Error(`This is a JHipster blueprint and should be used only like ${chalk.yellow('jhipster --blueprints quarkus')}`);
        }
    }

    get initializing() {
        const phaseFromJHipster = super._initializing();
        const phaseFromQuarkus = {
            defineQuarkusConstants() {
                this.quarkusVersion = QUARKUS_VERSION;
                this.CACHE_MAXIMUM_SIZE = CACHE_MAXIMUM_SIZE;
                this.CACHE_EXPIRE_AFTER_WRITE = CACHE_EXPIRE_AFTER_WRITE;
            },
        };
        return { ...phaseFromJHipster, ...phaseFromQuarkus };
    }

    get prompting() {
        return {
            ...super._prompting(),
            askForServerSideOpts: prompts.askForServerSideOpts,
            askForOptionalItems: undefined,
        };
    }

    get configuring() {
        return super._configuring();
    }

    get composing() {
        return super._composing();
    }

    get loading() {
        return super._loading();
    }

    get preparing() {
        return {
            ...super._preparing(),
            configureGlobalQuarkus() {
                // Override JHipster cacheManagerIsAvailable property to only handle Quarkus caches
                this.cacheManagerIsAvailable = ['caffeine', 'redis'].includes(this.cacheProvider);
                this.GRADLE_VERSION = '7.6';
            },
        };
    }

    get default() {
        return super._default();
    }

    get writing() {
        return writeFiles();
    }

    get postWriting() {
        return {
            ...super._postWriting(),
            updateKeycloakRealmTestConfiguration() {
                if (this.jhipsterConfig.authenticationType === 'oauth2') {
                    const realmConf = `${SERVER_TEST_RES_DIR}jhipster-realm.json`;
                    if (this.fs.exists(realmConf)) {
                        this.replaceContent(
                            realmConf,
                            `
      \\"directAccessGrantsEnabled\\"\\:\\s+false,`,
                            `
      "directAccessGrantsEnabled": true,`,
                            true
                        );
                    }
                }
            },
            updatePackageJsonScripts() {
                this.packageJson.merge({
                    scripts: {
                        'ci:backend:test': 'npm run backend:info && npm run backend:doc:test && npm run backend:unit:test',
                    },
                });
                if (this.buildToolGradle) {
                    this.packageJson.merge({
                        scripts: {
                            'ci:native:prod': './gradlew build -Dquarkus.package.type=native -x webapp -x test',
                            'ci:e2e:dev': 'concurrently -k -s first "./gradlew" "npm run e2e:headless"',
                            'ci:e2e:server:start':
                                'java -jar build/quarkus-app/quarkus-run.$npm_package_config_packaging -Dquarkus.profile=$npm_package_config_default_environment',
                            'java:jar': './gradlew build -x test -x integrationTest',
                        },
                    });
                } else {
                    this.packageJson.merge({
                        scripts: {
                            'ci:native:prod': './mvnw verify -Pnative,-webapp',
                            'ci:e2e:dev': 'concurrently -k -s first "./mvnw" "npm run e2e:headless"',
                            'ci:e2e:server:start':
                                'java -jar target/quarkus-app/quarkus-run.$npm_package_config_packaging -Dquarkus.profile=$npm_package_config_default_environment',
                        },
                    });
                }
            },
        };
    }

    get install() {
        return super._install();
    }

    get end() {
        return {
            end() {
                this.log(chalk.green.bold('\nServer application generated successfully.\n'));

                let executable = 'mvnw';
                if (this.buildTool === 'gradle') {
                    executable = 'gradlew';
                }
                let logMsgComment = '';
                if (os.platform() === 'win32') {
                    logMsgComment = ` (${chalk.yellow.bold(executable)} if using Windows Command Prompt)`;
                }
                this.log(chalk.green(`Run your Quarkus application:\n${chalk.yellow.bold(`./${executable}`)}${logMsgComment}`));
            },
        };
    }
};
