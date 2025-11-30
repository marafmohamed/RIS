'use client';

import { FiCheckCircle, FiStar, FiUser, FiClock } from 'react-icons/fi';
import { format } from 'date-fns';

export default function ValidationHistory({ report }) {
    if (!report) return null;

    const hasValidations = report.validatedBy && report.validatedBy.length > 0;
    const hasRatings = report.ratings && report.ratings.length > 0;

    if (!hasValidations && !hasRatings) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                Aucune validation ou notation pour ce rapport
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Validations Section */}
            {hasValidations && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-green-50 px-4 py-3 border-b border-green-100">
                        <h4 className="text-sm font-semibold text-green-900 flex items-center">
                            <FiCheckCircle className="mr-2" />
                            Validations ({report.validatedBy.length})
                        </h4>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {report.validatedBy.map((validation, index) => (
                            <div key={index} className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0">
                                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                                <FiUser className="h-4 w-4 text-green-600" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900">
                                                {validation.userName}
                                            </p>
                                            <div className="flex items-center mt-1 text-xs text-gray-500">
                                                <FiClock className="mr-1 h-3 w-3" />
                                                {format(new Date(validation.validatedAt), 'dd/MM/yyyy à HH:mm')}
                                            </div>
                                            {validation.feedback && (
                                                <div className="mt-2 text-sm text-gray-700 bg-gray-50 rounded p-2">
                                                    <p className="font-medium text-xs text-gray-500 mb-1">Commentaire:</p>
                                                    <p>{validation.feedback}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <FiCheckCircle className="mr-1 h-3 w-3" />
                                        Validé
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ratings Section */}
            {hasRatings && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-100">
                        <h4 className="text-sm font-semibold text-yellow-900 flex items-center justify-between">
                            <span className="flex items-center">
                                <FiStar className="mr-2" />
                                Notes ({report.ratings.length})
                            </span>
                            {report.averageRating > 0 && (
                                <span className="text-sm font-normal text-yellow-700">
                                    Moyenne: {report.averageRating.toFixed(1)}/5
                                </span>
                            )}
                        </h4>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {report.ratings.map((rating, index) => (
                            <div key={index} className="p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0">
                                        <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                                            <FiUser className="h-4 w-4 text-yellow-600" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-gray-900">
                                                {rating.userName}
                                            </p>
                                            <div className="flex items-center">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <FiStar
                                                        key={star}
                                                        className={`h-4 w-4 ${star <= rating.rating
                                                                ? 'text-yellow-400 fill-current'
                                                                : 'text-gray-300'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-1 text-xs text-gray-500">
                                            <FiClock className="mr-1 h-3 w-3" />
                                            {format(new Date(rating.ratedAt), 'dd/MM/yyyy à HH:mm')}
                                        </div>
                                        {rating.comment && (
                                            <div className="mt-2 text-sm text-gray-700 bg-gray-50 rounded p-2">
                                                <p className="font-medium text-xs text-gray-500 mb-1">Commentaire:</p>
                                                <p>{rating.comment}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
