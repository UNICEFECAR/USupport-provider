FROM node:20-bullseye-slim

WORKDIR /home/node/app
COPY ./service/ .

RUN npm ci

EXPOSE 3002

CMD [ "npm", "run", "prod" ]