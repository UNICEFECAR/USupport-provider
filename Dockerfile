FROM node:16.5.0-alpine3.13

WORKDIR /home/node/app
COPY ./service/ .

RUN npm ci

EXPOSE 3002

CMD [ "npm", "run", "prod" ]