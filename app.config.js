/* Load environment variables from .env and expose to Expo via `extra` */
require('dotenv').config();

export default ({ config }) => {
  return {
    ...config,
    expo: {
      ...config.expo,
      extra: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      },
    },
  };
};
