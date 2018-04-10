var dap = libraries.dap;

return {
    type: "dap-dataset",
    url: dap.getPackageShowUrl(dataset.id),
    id: dap.id,
    name: dap.name
};
