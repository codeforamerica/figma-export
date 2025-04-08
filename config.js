module.exports = {
  'TOKEN': '',           // Replace with your personal Figma access token
  'FILE': '',            // Replace with your file key ID
  'PAGES': [             // Add the pages in the file you want to extract from
    {
      'ID': ''           // The node ID of the page to retrieve
    }
  ],
  'COMPONENTs': [        // Names of the components you want to pull properties from in each page
    'Application Question'
  ],
  'EXPORT': './data',    // File to export data to
  'HEADINGS': [          // Column headings for the export
    'ID',
    'Required',
    'Question (New)',
    'Question (Current)',
    'Question (Not Changed)',
    'Flow',
    'Section'
  ],
  'DELIMITER': '|'       // Column delimiter
};