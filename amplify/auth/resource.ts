import { defineAuth } from '@aws-amplify/backend';

/** Cognito user pool: email + password, 6-digit email verification code. */
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
      verificationEmailSubject: 'Your EcoMap verification code',
      verificationEmailBody: (createCode) => `Welcome to EcoMap. Your verification code is ${createCode()}`,
    },
  },
});
