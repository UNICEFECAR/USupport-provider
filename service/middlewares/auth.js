import passport from "passport";
import passportJWT from "passport-jwt";

import { getUserByID } from "#queries/users";
import {
  getProviderByUserID,
  getProviderWorkWithQuery,
  getProviderLanguageIdsQuery,
  getProviderLanguagesQuery,
} from "#queries/providers";

import { notAuthenticated } from "#utils/errors";

const jwtStrategy = passportJWT.Strategy;
const extractJWT = passportJWT.ExtractJwt;

const JWT_KEY = process.env.JWT_KEY;

passport.use(
  "jwt",
  new jwtStrategy(
    {
      jwtFromRequest: extractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_KEY,
      issuer: "online.usupport.userApi",
      audience: "online.usupport.app",
      algorithms: ["HS256"],
      passReqToCallback: true,
    },
    async (req, jwt_payload, done) => {
      try {
        const country = req.header("x-country-alpha-2");
        const user_id = jwt_payload.sub;
        const user = await getUserByID(country, user_id)
          .then((res) => res.rows[0])
          .catch((err) => {
            throw err;
          });
        let provider = await getProviderByUserID(country, user_id)
          .then((res) => res.rows[0])
          .catch((err) => {
            throw err;
          });

        if (!user && !provider) {
          done(null, false);
        }

        const providerLanguageIds = await getProviderLanguageIdsQuery(
          country,
          provider.provider_detail_id
        )
          .then((res) => res.rows)
          .catch((err) => {
            throw err;
          });

        const providerLanguages = await getProviderLanguagesQuery(
          providerLanguageIds.map((language) => language.language_id)
        )
          .then((res) => res.rows)
          .catch((err) => {
            throw err;
          });

        // Get the work with areas of the provider from the provider_detail_work_with_links table
        const providerWorkWith = await getProviderWorkWithQuery(
          country,
          provider.provider_detail_id
        )
          .then((res) => res.rows)
          .catch((err) => {
            throw err;
          });

        provider = {
          ...provider,
          languages: providerLanguages,
          work_with: providerWorkWith,
        };

        done(null, user, provider);
      } catch (error) {
        done(error);
      }
    }
  )
);

export const authenticateJWT = (isMiddleWare, req, res, next) => {
  passport.authenticate(
    "jwt",
    { session: false },
    async (err, user, provider) => {
      const language = req.header("x-language-alpha-2");

      if (err || !user || !provider) {
        return next(notAuthenticated(language));
      }
      req.user = user;
      req.provider = provider;

      if (isMiddleWare) return next();
      else {
        return res.status(200).send({ user: req.user, provider: req.provider });
      }
    }
  )(req, res, next);
};

export const securedRoute = (req, res, next) => {
  return authenticateJWT(true, req, res, next);
};
