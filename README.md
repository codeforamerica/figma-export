# Figma Application Question Export

Exports component properties, or meta data, from Figma files that use the **Application Question** component to design integrated benefit applications.

![Preview](image.png)

## Instructions

1. Rename the `config.js` file to `.config.js` and add the following information
    * Your personal Figma access token.
    * The file key ID to pull from.
    * The node IDs of pages in the file to pull from.

1. Run the command `node meta.js` to request data and build the export.
