const fs = require('fs');
const config = require('./.config.js');

const documentKey = '11741:224247'; // Need to replace this with something manageable

/**
 * Get all visible instances of a component by name.
 *
 * @param   {String}  req            The API request URL
 * @param   {String}  componentName  The name of the component to retrieve
 * @param   {String}  figmaToken     The Figma personal access token to authenticate the request
 *
 * @return  {Array}                  A list of visible component instances
 */
async function findComponentByName(req, componentName, figmaToken) {
  console.log(`🙇 Requesting data from Figma ${req}`);

  const response = await fetch(req, {
    headers: {
      'X-Figma-Token': figmaToken
    }
  });

  const data = await response.json();

  console.log(`✨ Request successful!`);

  let questions = [];

  console.log(`🔍 Finding visible components in the request`);

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
  let questions = await findComponentByName(req, componentName, figmaToken);

  // Write our data so far to check.
  console.log(`📝 Writing full data copy to ${config.COPY}`);

  fs.writeFile(config.COPY, JSON.stringify(questions), 'utf-8', () => {});

  let body = 'ID, Required\n';

  console.log(`🛠️  Building export`);

  for (let i = 0; i < questions.length; i++) {
    let line = [];

    // console.dir(questions[i].componentProperties);

    // Replace with property configuration
    // ID, Question, Flow, Flow Code(?), Section Code(?), Question Code(?), Question Number(?), Programs, Required
    line.push(getProp(questions[i].componentProperties, '🟣 ID').replace(/\n/g, ' '));
    line.push(getProp(questions[i].componentProperties, '🔴 Required'));

    // Question Text
    // Need to inspect children of questions[i].componentProperties;

    // for (const [key, value] of Object.entries(questions[i].componentProperties)) {
    //   // Write a new line to the string that includes
    //   // ID, Question, Flow, Flow Code(?), Section Code(?), Question Code(?), Question Number(?), Programs, Required

    //   // Question text
    //   // if (key.includes('🔘 UI Element')) {
    //   //   console.dir(value);
    //   // }

    //   for (let index = 0; index < questions[i].children.length; index++) {
    //     const element = questions[i].children[index];

    //     if (typeof element.componentPropertyReferences.mainComponent != 'undefined' && element.componentPropertyReferences.mainComponent.includes('🔘 UI Element')) {
    //       // console.dir(element);

    //       // for (let c = 0; c < element['children'].length; c++) {
    //       //   // const element = array[index];
    //       //   // console.dir(element['children'][c]);
    //       //   if (element['children'][c].name === 'Text input label') {
    //       //     console.dir(element['children'][c]);
    //       //   }

    //       //   break;
    //       // }
    //       // if (typeof element.componentProperties != 'undefined') {
    //       //   console.dir( getProp(element.componentProperties, 'Text input label') );
    //       // }
    //     }
    //   }
    // }

    body += line.join(', ') + '\n';
  }

  console.log(`✨ Writing export to ${config.EXPORT}!`);

  fs.writeFile(config.EXPORT, body, 'utf-8', () => {});
}

// Need to replace this with multiple requests
fetchComponentInstances(
  `https://api.figma.com/v1/files/${config.FILE}/nodes?ids=${config.PAGES[0]}`,
  config.COMPONENT,
  config.TOKEN
);
