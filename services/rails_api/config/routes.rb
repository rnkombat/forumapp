Rails.application.routes.draw do
  get "/threads", to: "threads#index"
end
