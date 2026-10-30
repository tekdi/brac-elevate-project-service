FROM node:24.22.1

# Install necessary system dependencies for canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    libfreetype6-dev \
    pkg-config \
    gcc \
    g++ \
    make \
    python3
    
#Set working directory
WORKDIR /opt/projects

#Copy package.json file
COPY ./package.json /opt/projects/package.json

#Install node packages
RUN npm install
RUN npm install -g nodemon@2.0.20

#Copy all files 
COPY . /opt/projects

#Expose the application port
EXPOSE 5000

#Start the application
# CMD ["npm", "run", "dev"]
CMD ["node", "app.js"]