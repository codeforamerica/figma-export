const fs = require('fs');
const path = require('path');

const configPath = path.resolve('./.config.js');
delete require.cache[configPath];
const config = require(configPath);

let DATA = [];

/**
 * [async description]
 *
 * @param   {String}  req         The API request URL
 * @param   {String}  figmaToken  The Figma personal access token to authenticate the request
 *
 * @return  {Object}              The request response JSON object
 */
async function fetchFigma(req, figmaToken) {
  console.log(`🙇 Requesting data from Figma ${req}`);

  const response = await fetch(req, {
    headers: {
      'X-Figma-Token': figmaToken
    }
  });

  let pageData = await response.json();

  DATA.push(pageData);

  console.log(`✨ Request successful!`);

  return pageData;
}

/**
 * Get all visible instances of a component by name.
 *
 * @param   {String}  data           JSON to search
 * @param   {String}  page           ...
 * @param   {String}  componentName  The name of the component to retrieve
 *
 * @return  {Array}                  A list of visible component instances
 */
async function findComponentByName(data, page, componentName) {
  let components = [];
  let nesting = [];
  let pageData = data.nodes[page.ID.split('-').join(':')];
  let topLevel = pageData.document;

  console.log(`🔍 Finding visible ${componentName} components in the request`);

  let searchNodes = (node) => {
    if (node.type === 'FRAME') {
      nesting.push(node.name);
    }

    if (false != node.visible && node.type === 'INSTANCE' && node.name.includes(componentName)) {
      let nodeCopy = {...node};

      nodeCopy.nesting = nesting;

      components.push(nodeCopy);
    } else if (node.children) {
      node.children.forEach(searchNodes);
    }
  }

  for (let index = 0; index < topLevel.children.length; index++) {
    nesting = [pageData.document.name];

    searchNodes(topLevel.children[index]);
  }

  return components;
}

/**
 * Recursively search for a text layer by its original label and return the characters in the layer
 *
 * @param   {String}  data           JSON to search
 * @param   {String}  componentName  The name of the text layer to retrieve
 *
 * @return  {Array}                  All of the text layer contents that match the layer name
 */
async function findLayersByName(data, layerName) {
  let layers = [];

  function searchLayers(node) {
    if (node.type === 'TEXT' && node.name.includes(layerName)) {
      layers.push(node.characters);
    } else if (node.type === 'TEXT' && node.componentPropertyReferences && node.componentPropertyReferences.characters.includes(layerName)) {
      layers.push(node.characters);
    }

    if (node.children) {
      node.children.forEach(searchLayers);
    }
  }

  searchLayers(data);

  return layers;
}

/**
 * Get a clean property value from a component's property object.
 *
 * @param   {Object}  obj   The component properties object
 * @param   {String}  prop  The component property name to retrieve. Works with a partial string.
 *
 * @return  {Mixed}         Value of the component property. Type varies by property
 */
function getProp(obj, prop) {
  for (const [key, value] of Object.entries(obj)) {
    if (key.includes(prop)) {
      return value.value;
    }
  }
}

function cleanText(str) {
  return str.replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/[\u2028]/g, ' ')
    .replace(/(–)\1+/g, '$1')
    .split(' – ')
    .join('; ');
}

/**
 * Get component instances and build data object for export. Writes files locally.
 *
 * @param   {String}  req            The API request URL
 * @param   {String}  page           ...
 * @param   {String}  componentName  The name of the component to retrieve
 * @param   {String}  figmaToken     The Figma personal access token to authenticate the request
 */
async function fetchComponentInstances(req, page, componentName, figmaToken) {
  let data = await fetchFigma(req, figmaToken);

  let questions = await findComponentByName(data, page, componentName);

  // Write our data so far to check.
  console.log(`📝 Writing full data copy to ${config.COPY}`);

  fs.writeFile(config.COPY, JSON.stringify(data), 'utf8', () => {});

  let body = config.HEADINGS.join(config.DELIMITER) + '\n';

  console.log(`🛠️  Building export and populating the following columns; ${config.HEADINGS.join(', ')}`);

  for (let i = 0; i < questions.length; i++) {
    let line = [];

    // Replace with property configuration
    line.push(getProp(questions[i].componentProperties, '🟣 ID').replace(/\n/g, '; '));
    line.push(getProp(questions[i].componentProperties, '🔴 Required'));

    // Question Text
    let question = await findLayersByName(questions[i], 'Text input label');
    line.push(question.join('; '));

    // Current Question
    let current = await findLayersByName(questions[i], 'Question (Current)');
    let currentCharacters = cleanText(current[0]);
    line.push((currentCharacters === 'Current: Last name') ? '' : currentCharacters);

    // No Change
    let noChange = await findLayersByName(questions[i], 'Question (No Change)');
    let noChangeCharacters = cleanText(noChange[0]);
    line.push((noChangeCharacters === 'No Change: Last name') ? '' : noChangeCharacters);

    // Flow
    line.push(questions[i].nesting[0]);

    // Section
    line.push(questions[i].nesting[1]);

    body += line.join(config.DELIMITER) + '\n';
  }

  console.log(`✨ Writing export to ${config.EXPORT}`);

  await fs.writeFileSync(config.EXPORT, body, 'utf8');
}

// Need to replace this with multiple requests
fetchComponentInstances(`https://api.figma.com/v1/files/${config.FILE}/nodes?ids=${config.PAGES[0].ID}`,
  config.PAGES[0],
  config.COMPONENT,
  config.TOKEN
);
