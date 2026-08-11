FROM node:20-alpine

WORKDIR /home/node/app
COPY ./service/ .

RUN npm ci

EXPOSE 3002

CMD [ "npm", "run", "prod" ]