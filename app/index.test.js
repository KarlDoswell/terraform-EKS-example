const 
  chai = require('chai'),
  chaiHttp = require('chai-http'),
  app = require('./index.js');

const { expect } = chai;
chai.use(chaiHttp);

  
describe('running the server', ()=>{
  it('should have a health check route at no path', async ()=>{
    let response = await chai.request(app)
      .get(`/`)
    expect(response.status).to.equal(200)
    expect(response.text).to.equal('Healthy!')
  })
  it('should have a hello world response at /hello', async ()=>{
    let response = await chai.request(app)
      .get(`/hello`)
    expect(response.status).to.equal(200)
    expect(response.text).to.equal('Hello World!')
  })
})