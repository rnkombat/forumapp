FROM ruby:3.2

RUN apt-get update -y && apt-get install -y build-essential libpq-dev
WORKDIR /app

# 先に Gem を入れる層を固める
COPY Gemfile Gemfile.lock ./
RUN bundle install

# アプリ本体
COPY . .

EXPOSE 3000
CMD ["bash", "-lc", "bin/rails db:prepare && bin/rails s -b 0.0.0.0 -p 3000"]
