export default {
  plugins: ['prettier-plugin-svelte'],
  // No reason other than the JSON file was already formatted with 4 spaces
  // when we made this prettier file
  overrides: [
    {
      files: '*.json',
      options: {
        tabWidth: 4,
      },
    },
  ],
};