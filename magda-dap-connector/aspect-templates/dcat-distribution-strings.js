var moment = libraries.moment;

return {
    title: distribution.title || distribution.id,
    description: distribution.description || undefined,
    issued: distribution.published
        ? moment.utc(distribution.published).format()
        : undefined,
    modified: undefined,
    license: dataset.licence || undefined,
    accessURL: dataset.self || undefined,
    downloadURL: dataset.data || undefined,
    mediaType: dataset.collectionType || undefined,
    format: distribution.format || undefined
};
