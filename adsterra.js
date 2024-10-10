require('dotenv').config();
const axios = require('axios');



const getDomains = async (apiKey) => {
    try {
      const options = {
        method: 'GET',
        url: 'https://api3.adsterratools.com/publisher/domains.json',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      };
  
      const response = await axios.request(options);
      const domains = response?.data?.items || [];
  
      // Exit early if the websiteList is empty
      if (domains.length === 0) return 'No Websites Found';
  
      return domains;
  
    } catch (error) {
      console.error('Error fetching domains from Adsterra:', error);
      return 'Adsterra Error: \nFailed to retrieve Websites or Direct Links';
    }
  };


const fetchWebsites = async (apiKey) => {
  try {
    const websites = await getDomains(apiKey)
    const filteredWebsites = websites.filter( website => !website.title.toLowerCase().includes('direct-link') )

    if(filteredWebsites === 0) return 'No Website Found'

    const message = filteredWebsites.map( website => `🆔  ${website.id}\n🖥️  ${website.title}\n`).join('\n')
    console.log(message)
    return message

  } catch (error) {
    console.log('Error fetching websites', error)
    return 'Adsterra Error:\nFailed to retrieve websites'
  }
}


const fetchDirectLinks = async (apiKey) => {
  try {
    const domains = await getDomains(apiKey)
    const filteredDirectLink = domains.filter( domain => domain.title.toLowerCase().includes('direct-link') )

    if(filteredDirectLink === 0) return 'No Direct Links Found'

    const domain_id = filteredDirectLink[0].id

    const options = {
      method: 'GET',
      url: `https://api3.adsterratools.com/publisher/domain/${domain_id}/placements.json`,
      headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey
      }
    }
    
    const response = await axios.request(options)
    const direct_links = response?.data?.items || []
    const message = direct_links.map( direct_link => `____ ${direct_link.alias} ____\n\n${direct_link.direct_url}\n`).join('\n\n')
    console.log(message)
    return message

 } catch (error) {
    console.log('Error fetching Direct Links', error)
    return 'Adsterra Error:\nFailed to retrieve Direct Links'
 }

}


const testAPi_status_code = async (api_key) => {
  try {
    const options = {
      method: 'GET',
      url: 'https://api3.adsterratools.com/publisher/domains.json',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': api_key,
      },
    };

    const response = await axios.request(options)
    console.log('Test api with status: ',response.status)
    return response.status
    
  } catch (error) {
    console.log('Test api with status: ',error.status)
    return error.message
  }
}

// testAPi_status_code('6f2ca8c74b791af8431f6o09b6c427f1')
// fetchWebsites()
// fetchDirectLinks()

module.exports = {fetchWebsites, fetchDirectLinks, testAPi_status_code}