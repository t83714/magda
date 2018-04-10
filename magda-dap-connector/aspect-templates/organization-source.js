var dap = libraries.dap;

return {
    type: "dap-organization",
    url: dap.getOrganizationShowUrl(organization.id),
    id: dap.id,
    name: dap.name
};
