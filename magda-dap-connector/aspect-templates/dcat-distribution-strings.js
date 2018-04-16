var moment = libraries.moment;

return {
    title: distribution.filename || distribution.id,
    description: distribution.description || undefined,
    issued: undefined,
    modified: distribution.lastUpdated
    ? moment.unix(distribution.lastUpdated).utc().format()
    : undefined,
    license: distribution.licence || undefined,
    accessURL: distribution.self || undefined,
    downloadURL: distribution.link.href || undefined,
    mediaType: distribution.link.type || undefined,
    format: distribution.link.type || undefined
};
