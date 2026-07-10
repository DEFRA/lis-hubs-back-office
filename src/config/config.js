import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

import { milliseconds } from '@livestock/ui-services/duration'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The deployed service version for logging and diagnostics',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3102,
    env: 'PORT'
  },
  basePath: {
    doc: 'Optional mount path for the application when it is hosted behind a proxy',
    format: String,
    default: '',
    env: 'BASE_PATH'
  },
  serviceName: {
    doc: 'Application service name',
    format: String,
    default: 'Livestock back office'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Base asset path for direct application access',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  staticCacheTimeout: {
    doc: 'Cache timeout for static assets in milliseconds',
    format: Number,
    default: milliseconds.oneDay,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  isProduction: {
    doc: 'Whether the application is running in production',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'Whether the application is running in development',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'Whether the application is running in test',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in',
      format: ['ecs', 'json', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: [],
      env: 'LOG_REDACT'
    }
  },
  session: {
    cache: {
      engine: {
        doc: 'Backend cache engine',
        format: ['redis', 'memory'],
        default: 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'Server-side session cache name',
        format: String,
        default: 'back-office-session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'Server-side session cache ttl',
        format: Number,
        default: milliseconds.fourHours,
        env: 'SESSION_CACHE_TTL'
      }
    },
    cookie: {
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: milliseconds.fourHours,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'Session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'Set secure flag on session cookie',
        format: Boolean,
        default: false,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      env: 'REDIS_PASSWORD',
      sensitive: true
    },
    keyPrefix: {
      doc: 'Redis key prefix',
      format: String,
      default: 'back-office:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster',
      format: Boolean,
      default: true,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: false,
      env: 'REDIS_TLS'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  profileService: {
    url: {
      doc: 'Profile service endpoint used to enrich hub auth sessions',
      format: String,
      nullable: true,
      default: null,
      env: 'PROFILE_SERVICE_URL'
    },
    apiKey: {
      doc: 'Optional API key sent to the profile service',
      format: String,
      default: '',
      env: 'PROFILE_SERVICE_API_KEY',
      sensitive: true
    },
    apiKeyHeader: {
      doc: 'Header name used when sending the profile service API key',
      format: String,
      default: 'x-api-key',
      env: 'PROFILE_SERVICE_API_KEY_HEADER'
    }
  },
  auth: {
    hubOrigin: {
      doc: 'Public origin for the back-office hub',
      format: String,
      default: 'http://localhost:3102',
      env: 'HUB_ORIGIN'
    },
    primaryProvider: {
      doc: 'Primary authentication provider for back-office',
      format: String,
      default: 'sso',
      env: 'AUTH_PRIMARY_PROVIDER'
    },
    fallbackProvider: {
      doc: 'Fallback authentication provider for back-office',
      format: String,
      default: 'defra-ci',
      env: 'AUTH_FALLBACK_PROVIDER'
    },
    hubJwt: {
      cookieName: {
        doc: 'Cookie name that carries the hub-issued JWT',
        format: String,
        default: 'livestock_hub_jwt',
        env: 'HUB_JWT_COOKIE_NAME'
      },
      secret: {
        doc: 'Shared secret used to sign and verify hub-issued JWTs',
        format: String,
        default: 'local-dev-hub-jwt-signing-secret-please-change-1234567890',
        env: 'HUB_JWT_SECRET',
        sensitive: true
      },
      issuer: {
        doc: 'Issuer used for hub-issued JWTs',
        format: String,
        default: 'http://localhost:3102',
        env: 'HUB_JWT_ISSUER'
      },
      audience: {
        doc: 'Audience used for hub-issued JWTs',
        format: String,
        default: 'livestock-spokes',
        env: 'HUB_JWT_AUDIENCE'
      },
      ttlSeconds: {
        doc: 'TTL in seconds for hub-issued JWTs',
        format: Number,
        default: 14400,
        env: 'HUB_JWT_TTL_SECONDS'
      }
    },
    providers: {
      sso: {
        discoveryUrl: {
          doc: 'OIDC discovery URL for the primary SSO provider',
          format: String,
          nullable: true,
          default: null,
          env: 'SSO_OIDC_DISCOVERY_URL'
        },
        clientId: {
          doc: 'OIDC client id for the primary SSO provider',
          format: String,
          default: 'back-office-sso-client',
          env: 'SSO_OIDC_CLIENT_ID'
        },
        clientSecret: {
          doc: 'OIDC client secret for the primary SSO provider',
          format: String,
          default: 'back-office-sso-secret',
          env: 'SSO_OIDC_CLIENT_SECRET',
          sensitive: true
        },
        redirectPath: {
          doc: 'OIDC callback path for the primary SSO provider',
          format: String,
          default: '/sso',
          env: 'SSO_OIDC_REDIRECT_PATH'
        },
        serviceId: {
          doc: 'Optional service id for the primary SSO provider',
          format: String,
          nullable: true,
          default: null,
          env: 'SSO_OIDC_SERVICE_ID'
        }
      },
      'defra-ci': {
        discoveryUrl: {
          doc: 'OIDC discovery URL for the Defra CI fallback provider',
          format: String,
          nullable: true,
          default: null,
          env: 'DEFRA_CI_OIDC_DISCOVERY_URL'
        },
        clientId: {
          doc: 'OIDC client id for the Defra CI fallback provider',
          format: String,
          default: 'back-office-defra-ci-client',
          env: 'DEFRA_CI_OIDC_CLIENT_ID'
        },
        clientSecret: {
          doc: 'OIDC client secret for the Defra CI fallback provider',
          format: String,
          default: 'back-office-defra-ci-secret',
          env: 'DEFRA_CI_OIDC_CLIENT_SECRET',
          sensitive: true
        },
        redirectPath: {
          doc: 'OIDC callback path for the Defra CI fallback provider',
          format: String,
          default: '/sso',
          env: 'DEFRA_CI_OIDC_REDIRECT_PATH'
        },
        serviceId: {
          doc: 'Optional service id for the Defra CI fallback provider',
          format: String,
          nullable: true,
          default: null,
          env: 'DEFRA_CI_OIDC_SERVICE_ID'
        }
      }
    }
  }
})

config.validate({ allowed: 'strict' })
