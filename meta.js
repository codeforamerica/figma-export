const fs = require('fs');
const path = require('path');

const configPath = path.resolve('./.config.js');
delete require.cache[configPath];
const config = require(configPath);

let DATA = [];

/**
 * Make a request to the Figma API and return the JSON response.
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
 * @param   {String}  componentNames  The name of the component to retrieve
 *
 * @return  {Array}                  A list of visible component instances
 */
async function findComponentByName(data, page, componentNames) {
  let components = [];
  let nesting = [];
  let pageData = data.nodes[page.ID.split('-').join(':')];
  let topLevel = pageData.document;

  console.log(`🔍 Finding visible ${componentNames.join(', and')} components in the request`);

  let searchNodes = (node) => {
    if (node.type === 'FRAME') {
      nesting.push(node.name);
    }

    if (
      false != node.visible &&
      node.type === 'INSTANCE' &&
      componentNames.find(c => node.name.includes(c))
    ) {
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
 * @param   {String}  data            JSON to search
 * @param   {String}  componentNames  The name of the text layer to retrieve
 *
 * @return  {Array}                   All of the text layer contents that match the layer name
 */
async function findLayersByName(data, layerName) {
  let layers = [];

  function searchLayers(node) {
    if (node.type === 'TEXT' && node.name.includes(layerName)) {
      layers.push(node.characters);
    } else if (node.type === 'TEXT' &&
      node.componentPropertyReferences &&
      node.componentPropertyReferences.characters &&
      node.componentPropertyReferences.characters.includes(layerName)) {
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

/**
 * Remove unwanted text and formatting from strings. Removes new lines, hidden
 * characters, and dash separators.
 *
 * @param   {String}  str  The string to clean.
 *
 * @return  {String}       The clean string.
 */
function cleanText(str) {
  return str.replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/[\u2028]/g, ' ')
    .replace(/(—)\1+/g, '$1')
    .split(' – ')
    .join('; ')
    .replace(/(–)\1+/g, '$1')
    .split(' – ')
    .join('; ');
}

/**
 * Get component instances and build data object for export. Writes files locally.
 *
 * @param   {String}  req            The API request URL
 * @param   {String}  page           ...
 * @param   {String}  componentNames The name of the component to retrieve
 * @param   {String}  figmaToken     The Figma personal access token to authenticate the request
 */
async function fetchComponentInstances(req, page, componentNames, figmaToken) {
  let data = await fetchFigma(req, figmaToken);
  let questions = await findComponentByName(data, page, componentNames);
  let fileName = `${config.EXPORT}.${page.ID}`;

  fs.writeFile(`${fileName.replace(config.EXPORT, 'copy')}.json`, JSON.stringify(data), 'utf8', () => {
    console.log(`📝 Full data copy written to ${fileName}.json`);
  });

  let body = config.HEADINGS.join(config.DELIMITER) + '\n';

  console.log(`🛠️  Building export and populating the following columns; ${config.HEADINGS.join(', ')}`);

  for (let i = 0; i < questions.length; i++) {
    let line = [];
    let question = questions[i];

    // ID
    let id = getProp(question.componentProperties, '🟣 ID');
    line.push((id) ? id.replace(/\n/g, '; ').replace(/[\u2028]/g, '; ') : '');

    // Required
    let required = getProp(question.componentProperties, '🔴 Required');
    line.push((required) ? required : false);

    // Question Text
    let questionText = [];

    if (question.name.includes('Form Card/Header')) {
      questionText = [getProp(question.componentProperties, 'Form Card Heading')];
    } else if (question.name.includes('Application Question')) {
      questionText = await findLayersByName(question, 'Text input label');
    }

    line.push(questionText.join('; '));

    // Current Question
    let current = await findLayersByName(question, 'Question (Current)');
    let currentCharacters = (current[0]) ? cleanText(current[0]) : '';
    line.push((currentCharacters === 'Current: Last name') ? '' : currentCharacters);

    // No Change
    let noChange = await findLayersByName(question, 'Question (No Change)');
    let noChangeCharacters = (noChange[0]) ? cleanText(noChange[0]) : '';
    line.push((noChangeCharacters === 'No Change: Last name') ? '' : noChangeCharacters);

    // Flow
    line.push(question.nesting[0]);

    // Section
    line.push(question.nesting[1]);

    body += line.join(config.DELIMITER) + '\n';
  }

  console.log(`✨ Writing export to ${fileName}.csv`);

  await fs.writeFileSync(`${fileName}.csv`, body, 'utf8');

  return true;
}

/**
 * Init
 */

(async function () {
  for (let p = 0; p < config.PAGES.length; p++) {
    const page = config.PAGES[p];

    fetchComponentInstances(`https://api.figma.com/v1/files/${config.FILE}/nodes?ids=${page.ID}`,
      page,
      config.COMPONENTS,
      config.TOKEN
    );
  }
})();
