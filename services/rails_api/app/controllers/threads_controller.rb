class ThreadsController < ApplicationController
  def index
    render json: [{ id: 1, title: "Welcome (Rails)" }]
  end
end