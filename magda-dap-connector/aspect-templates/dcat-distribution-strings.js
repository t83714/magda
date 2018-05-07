var moment = libraries.moment;
return {
    title: distribution.filename || distribution.id,
    description: distribution.description || undefined,
    issued: '',
    modified: distribution.lastUpdated
    ? moment.unix(distribution.lastUpdated).utc().format()
    : undefined,
    license: distribution.licence || undefined,
    accessURL: distribution.self || undefined,
    downloadURL: distribution.link.href || undefined,
    mediaType: distribution.link.mediaType || undefined,
    format: distribution.link.mediaType || undefined
};
