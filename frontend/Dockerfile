FROM node:20-alpine
WORKDIR /app

# package.jsonとlockファイルを先にコピー
COPY package*.json ./
RUN npm install

# 残りのソースコードをコピー
COPY . .

ENV HOST=0.0.0.0
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
