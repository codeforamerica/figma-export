const fs = require('fs');
const config = require('./.config.js');

const documentKey = '11741:224247'; // Need to replace this with something manageable

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

  let data = await response.json();

  console.log(`✨ Request successful!`);

  return data;
}

/**
 * Get all visible instances of a component by name.
 *
 * @param   {String}  data           JSON to search
 * @param   {String}  componentName  The name of the component to retrieve
 *
 * @return  {Array}                  A list of visible component instances
 */
async function findComponentByName(data, componentName) {
  let questions = [];

  console.log(`🔍 Finding visible ${componentName} components in the request`);

  function searchNodes(node) {
    if (false != node.visible && node.type === 'INSTANCE' && node.name.includes(componentName)) {
      questions.push(node);
    } else if (node.children) {
      node.children.forEach(searchNodes);
    }
  }

  // Need to replace documentKey with something manageable
  searchNodes(data.nodes[documentKey].document);

  return questions;
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

/**
 * Get component instances and build data object for export. Writes files locally.
 *
 * @param   {String}  req            The API request URL
 * @param   {String}  componentName  The name of the component to retrieve
 * @param   {String}  figmaToken     The Figma personal access token to authenticate the request
 */
async function fetchComponentInstances(req, componentName, figmaToken) {
  let data = await fetchFigma(req,figmaToken);

  let questions = await findComponentByName(data, componentName);

  // Write our data so far to check.
  console.log(`📝 Writing full data copy to ${config.COPY}`);

  fs.writeFile(config.COPY, JSON.stringify(questions), 'utf8', () => {});

  let body = 'ID, Required, Question, Current\n';

  console.log(`🛠️  Building export`);

  for (let i = 0; i < questions.length; i++) {
    let line = [];

    // Replace with property configuration
    // ID, Question, Flow, Flow Code(?), Section Code(?), Question Code(?), Question Number(?), Programs, Required
    line.push(getProp(questions[i].componentProperties, '🟣 ID').replace(/\n/g, ' | '));
    line.push(getProp(questions[i].componentProperties, '🔴 Required'));

    // Question Text
    let question = await findLayersByName(questions[i], 'Text input label');
    line.push(question.join(' | '));

    let current = await findLayersByName(questions[i], 'Question (Current)');

    let currentCharacters = current[0]
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/[\u2028]/g, ' ')
      .replace(/(–)\1+/g, '$1')
      .split(' – ')
      .join(' | ');

    line.push(currentCharacters);

    body += line.join(', ') + '\n';
  }

  console.log(`✨ Writing export to ${config.EXPORT}`);

  await fs.writeFileSync(config.EXPORT, body, 'utf8');
}

// Need to replace this with multiple requests
fetchComponentInstances(
  `https://api.figma.com/v1/files/${config.FILE}/nodes?ids=${config.PAGES[0]}`,
  config.COMPONENT,
  config.TOKEN
);
